/**
 * Dynamic Task Manager - Handles intelligent task assignment and work stealing
 */

import type { TaskStatus, AgentState, TeamContextManager } from "./team-context.js";

export class DynamicTaskManager {
  private context: TeamContextManager;
  private teamSize: number;
  enabled: boolean = true;
  
  private readonly STEAL_THRESHOLD_MS = 2 * 60 * 1000;
  
  constructor(context: TeamContextManager, teamSize: number, enabled?: boolean) {
    this.context = context;
    this.teamSize = teamSize;
    if (enabled !== undefined) this.enabled = enabled;
  }
  
  getNextTask(agentId: string): number | null {
    if (!this.enabled) return this.getFirstAvailableTask();
    
    const snapshot = this.context.getSnapshot();
    const agentState = snapshot.agentStates.get(agentId) as AgentState | undefined;
    
    if (agentState?.currentTaskIndex !== null) return null;
    
    const availableTasks = Array.from(snapshot.taskStates.values())
      .filter((task): task is TaskStatus => task.status === "pending")
      .sort((a, b) => {
        if (!a.assignee && b.assignee) return -1;
        if (a.assignee && !b.assignee) return 1;
        return a.index - b.index;
      });
    
    if (availableTasks.length === 0) return null;
    
    for (const task of availableTasks) {
      if (this.areDependenciesMet(task.index, snapshot)) {
        return task.index;
      }
    }
    
    return availableTasks[0]?.index ?? null;
  }
  
  private areDependenciesMet(taskIndex: number, snapshot: any): boolean {
    return true;
  }
  
  private getFirstAvailableTask(): number | null {
    const snapshot = this.context.getSnapshot();
    for (const task of snapshot.taskStates.values()) {
      const t = task as TaskStatus;
      if (t.status === "pending") return t.index;
    }
    return null;
  }
  
  stealWork(agentId: string): number | null {
    if (!this.enabled) return null;
    
    const snapshot = this.context.getSnapshot();
    const agentState = snapshot.agentStates.get(agentId) as AgentState | undefined;
    if (agentState?.status === "working") return null;
    
    const stealCandidates = Array.from(snapshot.taskStates.values())
      .filter((task): task is TaskStatus => {
        if (task.status !== "in_progress" && task.status !== "blocked") return false;
        const assignee = task.assignee;
        if (!assignee || assignee === agentId) return false;
        
        const assigneeState = snapshot.agentStates.get(assignee) as AgentState | undefined;
        if (!assigneeState) return false;
        
        if (task.status === "blocked") return true;
        if (task.claimedAt && Date.now() - task.claimedAt > this.STEAL_THRESHOLD_MS) return true;
        
        const assigneeTasks = Array.from(snapshot.taskStates.values())
          .filter((t): t is TaskStatus => t.assignee === assignee && t.status === "in_progress");
        if (assigneeTasks.length > 1) return true;
        
        return false;
      });
    
    if (stealCandidates.length === 0) return null;
    
    stealCandidates.sort((a, b) => {
      if (a.status === "blocked" && b.status !== "blocked") return -1;
      if (b.status === "blocked" && a.status !== "blocked") return 1;
      const aAge = a.claimedAt ? Date.now() - a.claimedAt : 0;
      const bAge = b.claimedAt ? Date.now() - b.claimedAt : 0;
      return bAge - aAge;
    });
    
    const targetTask = stealCandidates[0];
    return this.transferTask(targetTask.index, agentId, snapshot);
  }
  
  private transferTask(taskIndex: number, newAssignee: string, snapshot: any): number | null {
    const task = snapshot.taskStates.get(taskIndex) as TaskStatus | undefined;
    if (!task || !task.assignee || task.assignee === newAssignee) return null;
    
    const oldAssignee = task.assignee;
    task.assignee = newAssignee;
    
    const oldAgentState = snapshot.agentStates.get(oldAssignee) as AgentState | undefined;
    if (oldAgentState && oldAgentState.currentTaskIndex === taskIndex) {
      oldAgentState.currentTaskIndex = null;
      if (oldAgentState.status === "working") {
        oldAgentState.status = "idle";
        oldAgentState.activity = "Task reassigned";
      }
    }
    
    return taskIndex;
  }
  
  requestHelp(agentId: string, taskIndex: number, reason: string): void {
    console.log(`[DynamicTaskManager] Agent ${agentId} requests help on task ${taskIndex}: ${reason}`);
  }
  
  getLoadDistribution(): Array<{ agentId: string; taskCount: number; totalProgress: number }> {
    const snapshot = this.context.getSnapshot();
    const agentTasks = new Map<string, number>();
    
    snapshot.taskStates.forEach((task) => {
      const t = task as TaskStatus;
      if (t.assignee) {
        agentTasks.set(t.assignee, (agentTasks.get(t.assignee) || 0) + 1);
      }
    });
    
    return Array.from(snapshot.agentStates.keys())
      .map((agentId): { agentId: string; taskCount: number; totalProgress: number } => ({
        agentId: agentId as string,
        taskCount: agentTasks.get(agentId as string) || 0,
        totalProgress: 0,
      }))
      .sort((a, b) => b.taskCount - a.taskCount);
  }
  
  getOverloadedAgents(): string[] {
    const distribution = this.getLoadDistribution();
    // Consider an agent overloaded if they have 2 or more tasks
    return distribution.filter(agent => agent.taskCount >= 2).map(agent => agent.agentId);
  }
  
  getIdleAgents(): string[] {
    const snapshot = this.context.getSnapshot();
    return Array.from(snapshot.agentStates.values())
      .filter((agent): agent is AgentState => agent.status === "idle" || agent.status === "waiting")
      .map(agent => agent.id);
  }
  
  rebalanceIfNeeded(): Array<{ from: string; to: string; taskIndex: number }> {
    if (!this.enabled) return [];
    
    const transfers: Array<{ from: string; to: string; taskIndex: number }> = [];
    const distribution = this.getLoadDistribution();
    const overloaded = this.getOverloadedAgents();
    const idle = this.getIdleAgents();
    
    for (const fromAgent of overloaded) {
      if (idle.length === 0) break;
      
      const fromTasks = distribution.find(d => d.agentId === fromAgent)?.taskCount || 0;
      if (fromTasks <= 2) continue;
      
      const snapshot = this.context.getSnapshot();
      const stealableTasks = Array.from(snapshot.taskStates.values())
        .filter((t): t is TaskStatus => t.assignee === fromAgent && t.status === "in_progress");
      
      for (let i = 0; i < Math.min(stealableTasks.length, fromTasks - 1); i++) {
        if (idle.length === 0) break;
        
        const toAgent = idle[0];
        const taskIndex = stealableTasks[i].index;
        transfers.push({ from: fromAgent, to: toAgent, taskIndex });
        idle.shift();
      }
    }
    
    return transfers;
  }
  
  performAutoRebalance(): void {
    const transfers = this.rebalanceIfNeeded();
    for (const transfer of transfers) {
      console.log(`[DynamicTaskManager] Auto-rebalance: transfer task ${transfer.taskIndex} from ${transfer.from} to ${transfer.to}`);
    }
  }
}
