/**
 * AgentSession Team Manager - Full Collaboration System
 *
 * Provides true team collaboration with:
 * - Shared context (team status, progress, decisions)
 * - Message bus (async communication)
 * - Dynamic task management (work stealing, rebalancing)
 * - Conflict resolution (artifact locking, versioning)
 */

import {
  SessionManager,
  AgentSessionRuntime,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
  type SessionStartEvent,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "../config/config.js";
import { createSubLoaderToolDefinition } from "../tools/subtool-loader.js";
import { SharedWorkspace } from "./workspace.js";
import { TeamContextManager } from "./team-context.js";
import { TeamMessageBus, CHANNELS } from "./message-bus.js";
import { DynamicTaskManager } from "./dynamic-task-manager.js";
import { ConflictResolutionManager, CollaborativeWorkspace } from "./conflict-resolution.js";
import { createTeamOpsTool } from "./team-ops-tool.js";

const MAX_TEAM_SIZE = 4;

function validateOptions(
  teamSize: number,
  teamRoles: string[]
): { size: number; roles: string[] } {
  const size = Math.max(1, Math.min(teamSize, MAX_TEAM_SIZE));
  const roles: string[] = [];
  for (let i = 0; i < size; i++) {
    roles.push(teamRoles[i] ?? `agent-${i + 1}`);
  }
  return { size, roles };
}

/**
 * AgentTeamRuntime interface
 */
export interface AgentTeamRuntime {
  runtimes: AgentSessionRuntime[];
  size: number;
  roles: string[];
  dispose: () => Promise<void>;
}

/**
 * AgentTeam: Full collaborative team with all features
 */
export class AgentTeam implements AgentTeamRuntime {
  id: string = '';  // Team ID
  runtimes: AgentSessionRuntime[] = [];
  roles: string[] = [];
  size = 0;
  dispose: () => Promise<void>;

  // Collaboration infrastructure
  private context: TeamContextManager;
  private messageBus: TeamMessageBus;
  private dynamicManager: DynamicTaskManager;
  private conflictManager: ConflictResolutionManager;
  private collaborativeWorkspace: CollaborativeWorkspace;
  
  // State
  tasks: string[] = [];
  private taskStatuses: Map<number, any> = new Map();
  private agentStatuses: Map<string, any> = new Map();
  monitorInterval: any = null;
  
  constructor() {
    this.dispose = async () => {
      // Clear monitor interval if running
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
      await Promise.allSettled(
        this.runtimes.slice(1).map(rt =>
          rt.dispose().catch(err =>
            console.error("Failed to dispose child agent:", err)
          )
        )
      );
    };
    
    // Initialize collaboration components
    this.messageBus = new TeamMessageBus();
    this.conflictManager = new ConflictResolutionManager();
    this.collaborativeWorkspace = new CollaborativeWorkspace(this.conflictManager);
    this.context = new TeamContextManager(`team-${  Date.now()}`, 0, "");
    this.dynamicManager = new DynamicTaskManager(this.context, 0);
  }

  /** Set team ID */
  setTeamId(id: string): void {
    this.id = id;
  }
  
  getContext(): TeamContextManager {
    return this.context;
  }
  
  getMessageBus(): TeamMessageBus {
    return this.messageBus;
  }
  
  getCollaborativeWorkspace(): CollaborativeWorkspace {
    return this.collaborativeWorkspace;
  }
  
  getLoadDistribution() {
    return this.dynamicManager.getLoadDistribution();
  }
  
  getStuckTasks() {
    return this.context.getStuckTasks();
  }
  
  getTeamStatus() {
    return {
      agents: Array.from(this.agentStatuses.values()),
      tasks: Array.from(this.taskStatuses.values()),
      summary: this.context.getTeamSummary(),
      loadDistribution: this.dynamicManager.getLoadDistribution(),
    };
  }
  
  getTaskAssignee(taskIndex: number): string | null {
    const task = this.taskStatuses.get(taskIndex);
    return task?.assignee || null;
  }
  
  getMyCurrentTask(agentId: string): number | null {
    const status = this.agentStatuses.get(agentId);
    return status?.currentTaskIndex ?? null;
  }
  
  requestHelp(agentId: string, taskIndex: number, reason: string): void {
    this.dynamicManager.requestHelp(agentId, taskIndex, reason);
    this.context.blockTask(agentId, taskIndex, reason);
    
    // Broadcast help request
    this.messageBus.publish({
      channel: CHANNELS.TEAM_HELP,
      from: agentId,
      content: `Needs help on task ${taskIndex}: ${reason}`,
      type: "help_request",
    });
  }
  
  stealTask(agentId: string): number | null {
    const stolen = this.dynamicManager.stealWork(agentId);
    if (stolen !== null) {
      // Update task status
      const oldAssignee = this.taskStatuses.get(stolen)?.assignee;
      const task = this.taskStatuses.get(stolen);
      if (task) {
        task.assignee = agentId;
        task.status = "in_progress";
      }
      
      // Update old assignee status
      if (oldAssignee) {
        const oldStatus = this.agentStatuses.get(oldAssignee);
        if (oldStatus) {
          oldStatus.currentTaskIndex = null;
          oldStatus.status = "idle";
        }
      }
      
      // Update new assignee status
      const newStatus = this.agentStatuses.get(agentId);
      if (newStatus) {
        newStatus.currentTaskIndex = stolen;
        newStatus.status = "working";
      }
      
      return stolen;
    }
    return null;
  }
  
  releaseTask(agentId: string, taskIndex: number): boolean {
    const task = this.taskStatuses.get(taskIndex);
    if (!task || task.assignee !== agentId) {
      return false;
    }
    
    task.assignee = null;
    task.status = "pending";
    task.claimedAt = null;
    
    const status = this.agentStatuses.get(agentId);
    if (status) {
      status.currentTaskIndex = null;
      status.status = "idle";
    }
    
    return true;
  }
  
  // Expose collaborative workspace instead of simple SharedWorkspace
  getWorkspace(): SharedWorkspace {
    // For backward compatibility: wrap collaborative workspace as SharedWorkspace
    // This is a simplification - in production would adapt
    return this.collaborativeWorkspace as any;
  }

  /** Register a runtime with its role */
  registerRuntime(runtime: AgentSessionRuntime, role: string): void {
    this.runtimes.push(runtime);
    this.roles.push(role);
    this.agentStatuses.set(role, {
      id: role,
      status: "idle",
      currentTaskIndex: null,
      activity: "Registered",
      lastHeartbeat: Date.now(),
      progress: 0,
    });
    // Also add to team context
    this.context.setAgentStatus(role, "idle", "Registered");
    this.size = this.runtimes.length;
    this.dynamicManager = new DynamicTaskManager(this.context, this.size);
  }

  /** Initialize tasks for this team with enhanced tracking */
  initialize(tasks: string[]): void {
    this.tasks = tasks;
    
    // Initialize task statuses
    this.taskStatuses.clear();
    for (let i = 0; i < tasks.length; i++) {
      this.taskStatuses.set(i, {
        index: i,
        description: tasks[i],
        assignee: null,
        status: "pending",
        claimedAt: null,
        completedAt: null,
        result: null,
        helpers: [],
      });
    }
    
    // Keep current agent states to restore into new context
    const agentStatesSnapshot = new Map(this.agentStatuses);
    
    // Reset context (new team session)
    this.context = new TeamContextManager(`team-${  Date.now()  }-${  Date.now()}`, tasks.length, "");
    
    // Restore agent states into new context
    for (const [agentId, status] of agentStatesSnapshot) {
      this.context.setAgentStatus(agentId, status.status, status.activity, status.progress);
    }
    
    // Update dynamic manager with new team size and context
    this.dynamicManager = new DynamicTaskManager(this.context, this.size);
  }

  /** Get agent ID from runtime */
  getAgentId(runtime: AgentSessionRuntime): string | undefined {
    return this.roles[this.runtimes.indexOf(runtime)] || undefined;
  }

  /** Claim a pending task (atomic) - enhanced with dynamic manager */
  claimTask(agentId: string): number | null {
    // Try dynamic task manager first
    if (this.dynamicManager.enabled) {
      const dynamicTask = this.dynamicManager.getNextTask(agentId);
      if (dynamicTask !== null) {
        this.assignTask(agentId, dynamicTask);
        return dynamicTask;
      }
    }
    
    // Fallback to simple first-available
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.taskStatuses.get(i);
      if (task && task.status === "pending") {
        this.assignTask(agentId, i);
        return i;
      }
    }
    return null;
  }
  
  private assignTask(agentId: string, taskIndex: number): void {
    const task = this.taskStatuses.get(taskIndex);
    if (!task) return;
    
    task.assignee = agentId;
    task.status = "in_progress";
    task.claimedAt = Date.now();
    
    const agentStatus = this.agentStatuses.get(agentId);
    if (agentStatus) {
      agentStatus.currentTaskIndex = taskIndex;
      agentStatus.status = "working";
      agentStatus.lastHeartbeat = Date.now();
    }
    
    this.context.claimTask(agentId, taskIndex);
  }

  /** Release current task (agent voluntarily gives up) */
  releaseCurrentTask(agentId: string): boolean {
    const agentStatus = this.agentStatuses.get(agentId);
    if (!agentStatus?.currentTaskIndex) {
      return false;
    }
    return this.releaseTask(agentId, agentStatus.currentTaskIndex);
  }

  /** Report result for a task */
  reportResult(taskIndex: number, result: string): void {
    const task = this.taskStatuses.get(taskIndex);
    if (!task) return;
    
    task.status = "completed";
    task.completedAt = Date.now();
    task.result = result;
    
    const agentId = task.assignee;
    if (agentId) {
      const agentStatus = this.agentStatuses.get(agentId);
      if (agentStatus) {
        agentStatus.currentTaskIndex = null;
        agentStatus.status = "idle";
        agentStatus.progress = 100;
      }
      
      // Also update shared context so waitForCompletion works
      this.context.completeTask(agentId, taskIndex, result);
    }
  }

  /** Check if all tasks are done */
  private checkCompletion(): void {
    const allDone = Array.from(this.taskStatuses.values()).every(t => t.status === "completed");
    if (allDone) {
      // Update context completion count
      const summary = this.context.getTeamSummary();
      // No-op for now, context tracks its own completion
    }
  }

  /** Wait until all tasks complete */
  async waitForCompletion(): Promise<void> {
    // Poll context until all tasks are completed
    while (true) {
      const summary = this.context.getTeamSummary();
      if (summary.completedTasks === summary.totalTasks) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
    }
  }

  /** Get all results in order */
  getResults(): string[] {
    const results: string[] = new Array(this.tasks.length).fill(null);
    Array.from(this.taskStatuses.values())
      .sort((a, b) => a.index - b.index)
      .forEach(task => {
        results[task.index] = task.result || null;
      });
    return results as string[];
  }

  // Backward compatibility: Simple workspace (but we use collaborative internally)
  getSimpleWorkspace(): SharedWorkspace {
    // Create a compatibility wrapper
    return new SharedWorkspace();
  }
}

/**
 * Create team with full collaboration features
 */
export async function bootPiclawTeam(
  parentRuntime: AgentSessionRuntime,
  options: {
    teamSize?: number;
    teamRoles?: string[];
    tools?: string[];
  } = {}
): Promise<AgentTeam> {
  const cwd = parentRuntime.cwd;
  const agentDir = getAgentDir();

  // Validate and normalize options
  const { size: teamSize, roles: normalizedRoles } = validateOptions(
    options.teamSize ?? 2,
    Array.isArray(options.teamRoles) ? options.teamRoles : []
  );

  const team = new AgentTeam();
  // Register parent runtime
  team.registerRuntime(parentRuntime, "parent");

  for (let i = 0; i < teamSize; i++) {
    const factory: CreateAgentSessionRuntimeFactory = async ({
      cwd: sessionCwd,
      agentDir: sessionAgentDir,
      sessionManager,
      sessionStartEvent,
    }) => {
      const services = await createAgentSessionServices({
        cwd,
        agentDir: sessionAgentDir,
        authStorage: parentRuntime.services.authStorage,
        settingsManager: parentRuntime.services.settingsManager,
        modelRegistry: parentRuntime.services.modelRegistry,
      });

      const sessionResult = await createAgentSessionFromServices({
        services,
        sessionManager,
        sessionStartEvent,
        tools: options.tools,
        customTools: [
          createSubLoaderToolDefinition(cwd),
          createTeamOpsTool(team)
        ],
      });

      return {
        session: sessionResult.session,
        services,
        diagnostics: services.diagnostics,
      } as CreateAgentSessionRuntimeResult;
    };

    const startEvent: SessionStartEvent = {
      type: "session_start",
      reason: "new"
    };

    const runtime = await createAgentSessionRuntime(factory, {
      cwd,
      agentDir,
      sessionManager: parentRuntime.session.sessionManager,
      sessionStartEvent: startEvent,
    });

    // Register child runtime with team
    team.registerRuntime(runtime, normalizedRoles[i]);
  }

  // Set team ID and parent reference for events
  team.id = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  (team as any)._parentRuntime = parentRuntime;

  return team;
}

/**
 * Execute team tasks with collaboration
 * 
 * Each child agent runs in its own continuous loop until all tasks complete.
 * Events are emitted to team.events channel for parent observation.
 */
export async function executeTeamTasks(
  team: AgentTeam,
  tasks: string[]
): Promise<void> {
  // Initialize team with enhanced context
  team.initialize(tasks);
  
  const context = team.getContext();
  const messageBus = team.getMessageBus();
  
  context.setTeamFocus(`Working on ${tasks.length} tasks`, "collaborative_execution");
  
  // Emit team_started event
  messageBus.publish({
    channel: "team.events",
    from: "system",
    content: JSON.stringify({
      type: "team_started",
      timestamp: Date.now(),
      data: { tasks: tasks.length, agents: team.roles.slice(1) }
    }),
    type: "system",
  });

  // Build task list for prompt
  const bootstrapTasksList = tasks.map((t, i) => `[${i}] ${t}`).join("\n");

  // Initial prompt for each child agent
  const getBootstrapPrompt = (role: string) => `You are ${role}, an AI agent in a collaborative team.

Team tasks:
${bootstrapTasksList}

Your role: ${role}

IMPORTANT INSTRUCTIONS:
1. Use team_ops(action="claim_task") to get a task to work on
2. Use team_ops(action="update_status", status="working", activity="<what you're doing>")
3. Do your task using bash, read, write, grep, find, edit tools
4. Use team_ops(action="send_message", channel="team.chat", content="<update>") to communicate
5. When done, use team_ops(action="send_message", channel="team.chat", content="Task [X] completed!")

Always use team_ops tools to coordinate with the team.

Let's start!`;

  // Continuation prompt with context
  const getContinuationPrompt = (turnCount: number) => {
    const summary = context.getTeamSummary();
    const recentMessages = messageBus.getMessages("team.chat", { limit: 5 })
      .slice(-5)
      .map(m => `[${m.from}]: ${m.content}`)
      .join("\n");
    
    return `Turn ${turnCount + 1}. Continue working.

Status: ${summary.completedTasks}/${summary.totalTasks} tasks completed, ${summary.activeAgents} active agents.
${recentMessages ? `\nRecent messages:\n${recentMessages}\n` : ""}

Use team_ops to continue coordinating. If all tasks are done, say "All tasks completed!"`;
  };

  // Function to run continuous loop for each child agent
  async function runAgentLoop(runtime: AgentSessionRuntime, role: string, agentId: string): Promise<void> {
    // Emit agent_started
    messageBus.publish({
      channel: "team.events",
      from: "system",
      content: JSON.stringify({
        type: "agent_started",
        agentId,
        timestamp: Date.now(),
        data: { role }
      }),
      type: "system",
    });

    let turnCount = 0;
    const maxTurnsBeforeRestart = 25;

    while (true) {
      // Check if all tasks complete
      const summary = context.getTeamSummary();
      if (summary.completedTasks === summary.totalTasks && summary.totalTasks > 0) {
        messageBus.publish({
          channel: "team.events",
          from: "system",
          content: JSON.stringify({
            type: "agent_completed",
            agentId,
            timestamp: Date.now(),
            data: { role, turns: turnCount }
          }),
          type: "system",
        });
        break;
      }

      // Auto-restart after max turns
      if (turnCount > 0 && turnCount % maxTurnsBeforeRestart === 0) {
        messageBus.publish({
          channel: "team.events",
          from: "system",
          content: JSON.stringify({
            type: "agent_restart",
            agentId,
            timestamp: Date.now(),
            data: { turnCount }
          }),
          type: "system",
        });
      }

      try {
        const prompt = turnCount === 0 
          ? getBootstrapPrompt(role) 
          : getContinuationPrompt(turnCount);

        await runtime.session.prompt(prompt);
        turnCount++;

      } catch (err: any) {
        messageBus.publish({
          channel: "team.events",
          from: "system",
          content: JSON.stringify({
            type: "agent_error",
            agentId,
            timestamp: Date.now(),
            data: { error: err.message }
          }),
          type: "system",
        });
        console.error(`Agent ${agentId} error:`, err.message);
        break;
      }
    }
  }

  // Start each child agent in its own loop
  const childPromises = team.runtimes.slice(1).map((runtime, idx) => {
    const actualIdx = idx + 1;
    const role = team.roles[actualIdx];
    const agentId = role;
    
    return runAgentLoop(runtime, role, agentId).catch((err) => {
      console.error(`Agent ${role} loop failed:`, err);
    });
  });

  // Start background monitor for progress events
  team.monitorInterval = setInterval(() => {
    const summary = context.getTeamSummary();
    const parentRuntime = (team as any)._parentRuntime as any;
    
    // Emit progress to extension runner (for TUI)
    if (parentRuntime?.session?.extensionRunner?.emit) {
      parentRuntime.session.extensionRunner.emit("team_progress", {
        teamId: team.id,
        completed: summary.completedTasks,
        total: summary.totalTasks,
        activeAgents: summary.activeAgents,
      });
    }
    
    // Check completion
    if (summary.completedTasks === summary.totalTasks && summary.totalTasks > 0) {
      clearInterval(team.monitorInterval);
      team.monitorInterval = null;
      
      // Emit completion event
      if (parentRuntime?.session?.extensionRunner?.emit) {
        const results = team.getResults();
        parentRuntime.session.extensionRunner.emit("team_completed", {
          teamId: team.id,
          results,
          status: team.getTeamStatus(),
        });
      }
      
      messageBus.publish({
        channel: "team.events",
        from: "system",
        content: JSON.stringify({
          type: "team_completed",
          timestamp: Date.now(),
          data: { results: team.getResults() }
        }),
        type: "system",
      });
    }
  }, 2000);

  // Wait for all child agents to finish
  await Promise.all(childPromises);
}
