/**
 * Minimal Team Manager
 *
 * Simple task distribution and shared workspace for multi-agent collaboration.
 */

import {
  AgentSessionRuntime,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
  type SessionStartEvent,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { SharedWorkspace, type WorkspaceEntry } from "./workspace.js";
import { createTeamOpsTool } from "./team-ops-tool.js";

const MAX_TEAM_SIZE = 4;

function validateOptions(teamSize: number, teamRoles: string[]): { size: number; roles: string[] } {
  const size = Math.max(1, Math.min(teamSize, MAX_TEAM_SIZE));
  const roles: string[] = [];
  for (let i = 0; i < size; i++) {
    roles.push(teamRoles[i] ?? `agent-${i + 1}`);
  }
  return { size, roles };
}

export interface AgentTeamRuntime {
  runtimes: AgentSessionRuntime[];
  size: number;
  roles: string[];
  dispose: () => Promise<void>;
}

export class AgentTeam implements AgentTeamRuntime {
  id: string = '';
  runtimes: AgentSessionRuntime[] = [];
  roles: string[] = [];
  size = 0;
  dispose: () => Promise<void>;

  // State
  tasks: string[] = [];
  private taskStatuses: Map<number, { assignee: string | null; status: 'pending' | 'in_progress' | 'completed'; result: string }> = new Map();
  private agentStatuses: Map<string, { currentTaskIndex: number | null; status: string }> = new Map();
  private roleByAgentId: Map<string, string> = new Map(); // maps session.id -> role
  private workspace: SharedWorkspace;
  private messageBus: Map<string, Array<{ from: string; content: string; timestamp: number }>> = new Map();
  private lockQueue: (() => void)[] = [];
  private locked = false;
  monitorInterval: any = null;

  constructor() {
    this.dispose = async () => {
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
    this.workspace = new SharedWorkspace();
  }

  setTeamId(id: string): void {
    this.id = id;
  }

  getWorkspace(): SharedWorkspace {
    return this.workspace;
  }

  // Locking mechanism for concurrency control
  private async acquireLock(): Promise<void> {
    return new Promise<void>(resolve => {
      this.lockQueue.push(resolve);
      if (!this.locked) this.runNext();
    });
  }

  private runNext(): void {
    if (this.lockQueue.length > 0) {
      this.locked = true;
      const next = this.lockQueue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  private releaseLock(): void {
    this.locked = false;
    this.runNext();
  }

  async withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      return await fn();
    } finally {
      this.releaseLock();
    }
  }

  // Workspace operations with lock
  private async workspaceClear(): Promise<void> {
    this.workspace.clear();
  }

  async workspaceWrite(key: string, value: any, owner: string): Promise<void> {
    this.workspace.set(key, value, owner);
  }

  async workspaceRead(key: string): Promise<any> {
    return this.workspace.get(key);
  }

  async workspaceGetEntry(key: string): Promise<WorkspaceEntry | undefined> {
    return this.workspace.getEntry(key);
  }

  async workspaceList(): Promise<string[]> {
    return this.workspace.list();
  }

  async workspaceListByPrefix(prefix: string): Promise<string[]> {
    return this.workspace.listByPrefix(prefix);
  }

  async workspaceDelete(key: string): Promise<boolean> {
    return this.workspace.delete(key);
  }

  async workspaceToObject(): Promise<Record<string, any>> {
    return this.workspace.toObject();
  }

  // Compatibility for team-tool
  getContext(): { getTeamSummary: () => { totalTasks: number; completedTasks: number; activeAgents: number } } {
    return {
      getTeamSummary: () => ({
        totalTasks: this.tasks.length,
        completedTasks: Array.from(this.taskStatuses.values()).filter(t => t.status === 'completed').length,
        activeAgents: Array.from(this.agentStatuses.values()).filter(s => s.status === 'working').length,
      }),
    };
  }

  async sendMessage(channel: string, content: string, to?: string): Promise<void> {
    // In simplified version, we don't support direct messages; just broadcast to channel
    // Use 'parent' as generic sender for team tool messages
    await this.publishMessage(channel, 'parent', content);
  }

  async getMessages(channel: string, limit?: number): Promise<Array<{ from: string; content: string; timestamp: number }>> {
    return this.withLock(() => {
      const msgs = this.messageBus.get(channel) || [];
      return limit ? msgs.slice(-limit) : msgs;
    });
  }

  async publishMessage(channel: string, from: string, content: string): Promise<void> {
    return this.withLock(() => {
      if (!this.messageBus.has(channel)) {
        this.messageBus.set(channel, []);
      }
      this.messageBus.get(channel)!.push({ from, content, timestamp: Date.now() });
    });
  }

  async getTeamStatus(): Promise<{
    agents: Array<{ id: string; currentTaskIndex: number | null; status: string }>;
    tasks: Array<{ index: number; assignee: string | null; status: string; result: string }>;
    completedTasks: number;
    totalTasks: number;
  }> {
    return this.withLock(() => ({
      agents: Array.from(this.agentStatuses.entries()).map(([id, status]) => ({ id, ...status })),
      tasks: Array.from(this.taskStatuses.entries()).map(([idx, status]) => ({ index: idx, ...status })),
      completedTasks: Array.from(this.taskStatuses.values()).filter(t => t.status === 'completed').length,
      totalTasks: this.tasks.length,
    }));
  }

  async getMyCurrentTask(agentId: string): Promise<number | null> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      return this.agentStatuses.get(role)?.currentTaskIndex ?? null;
    });
  }

  async claimTask(agentId: string): Promise<number | null> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      for (let i = 0; i < this.tasks.length; i++) {
        const task = this.taskStatuses.get(i);
        if (task && task.status === 'pending') {
          task.assignee = role; // assign by role
          task.status = 'in_progress';
          this.agentStatuses.set(role, { currentTaskIndex: i, status: 'working' });
          console.log(`[DEBUG] Agent ${role} (session ${agentId}) claimed task ${i}: ${this.tasks[i].substring(0, 50)}...`);
          return i;
        }
      }
      console.log(`[DEBUG] Agent ${role} found no pending tasks`);
      return null;
    });
  }

  async releaseTask(agentId: string, taskIndex: number): Promise<boolean> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      const task = this.taskStatuses.get(taskIndex);
      if (!task || task.assignee !== role || task.status === 'completed') {
        return false;
      }
      task.assignee = null;
      task.status = 'pending';
      this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
      return true;
    });
  }

  async reportResult(taskIndex: number, result: string): Promise<void> {
    await this.withLock(() => {
      const task = this.taskStatuses.get(taskIndex);
      if (!task) {
        console.warn(`[DEBUG] reportResult: task ${taskIndex} not found`);
        return;
      }
      const agentId = task.assignee;
      task.status = 'completed';
      task.result = result;
      task.assignee = null; // Clear assignment if any
      if (agentId) {
        const status = this.agentStatuses.get(agentId);
        if (status) {
          status.currentTaskIndex = null;
          status.status = 'idle';
        }
      }
      console.log(`[DEBUG] Task ${taskIndex} completed by ${agentId}. Result preview: ${result.substring(0, 100)}...`);
    });
  }

  async completeTask(agentId: string, taskIndex: number, result: string): Promise<void> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    await this.withLock(() => {
      const task = this.taskStatuses.get(taskIndex);
      if (!task) return;
      if (task.assignee !== role) return;
      task.status = 'completed';
      task.result = result;
      task.assignee = null; // Clear assignment on completion
      const status = this.agentStatuses.get(role);
      if (status) {
        status.currentTaskIndex = null;
        status.status = 'idle';
      }
    });
  }

  async getResults(): Promise<string[]> {
    return this.withLock(() => {
      const results: string[] = new Array(this.tasks.length).fill('');
      this.taskStatuses.forEach((task, idx) => {
        results[idx] = task.result;
      });
      return results;
    });
  }

  async waitForCompletion(): Promise<void> {
    while (true) {
      const summary = await this.getTeamStatus();
      if (summary.completedTasks === summary.totalTasks && summary.totalTasks > 0) {
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  registerRuntime(runtime: AgentSessionRuntime, role: string): void {
    this.runtimes.push(runtime);
    this.roles.push(role);
    this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
    this.roleByAgentId.set((runtime.session as any).id, role);
    this.size = this.runtimes.length;
  }

  async initialize(tasks: string[]): Promise<void> {
    await this.withLock(async () => {
      this.tasks = tasks;
      this.taskStatuses.clear();
      for (let i = 0; i < tasks.length; i++) {
        this.taskStatuses.set(i, { assignee: null, status: 'pending', result: '' });
      }
      this.messageBus.clear();
      await this.workspaceClear();
      this.agentStatuses.clear();
      for (const role of this.roles) {
        this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
      }
    });
  }
}

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

  const { size: teamSize, roles: normalizedRoles } = validateOptions(
    options.teamSize ?? 2,
    Array.isArray(options.teamRoles) ? options.teamRoles : []
  );

  const team = new AgentTeam();
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
        customTools: [createTeamOpsTool(team)],
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

    // eslint-disable-next-line no-await-in-loop
    const runtime = await createAgentSessionRuntime(factory, {
      cwd,
      agentDir,
      sessionManager: parentRuntime.session.sessionManager,
      sessionStartEvent: startEvent,
    });

    team.registerRuntime(runtime, normalizedRoles[i]);
  }

  team.id = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  (team as any)._parentRuntime = parentRuntime;

  return team;
}

export async function executeTeamTasks(
  team: AgentTeam,
  tasks: string[]
): Promise<void> {
  await team.initialize(tasks);

  const bootstrapTasksList = tasks.map((t, i) => `[${i}] ${t}`).join("\n");

  const getBootstrapPrompt = (role: string) => `You are ${role}, an AI agent in a collaborative team.

Team tasks:
${bootstrapTasksList}

Your role: ${role}

INSTRUCTIONS:
1. Use team_ops(action="claim_task") to get a task
2. Work on the task using regular tools (bash, read, write, edit, git, etc.)
3. When done, call team_ops(action="complete_task", taskIndex=X, result="summary")
4. If you need to share data, use team_ops(action="workspace_write", key="...", value="...")
5. Communicate via team_ops(action="send_message", channel="team.chat", content="...")
6. Continue claiming tasks until all are done

Start by claiming your first task.`;

  const getContinuationPrompt = async (turnCount: number) => {
    const status = await team.getTeamStatus();
    const messages = await team.getMessages("team.chat", 5);
    const recentMessages = messages.map(m => `[${m.from}]: ${m.content}`).join("\n");

    return `Turn ${turnCount + 1}. Continue.

Progress: ${status.completedTasks}/${status.totalTasks} tasks completed.
${recentMessages ? `\nRecent messages:\n${recentMessages}\n` : ""}

Use team_ops to continue. If all tasks done, finish up.`;
  };

  async function runAgentLoop(runtime: AgentSessionRuntime, role: string): Promise<void> {
    let turnCount = 0;
    const maxTurnsPerAgent = 50;

    console.log(`[DEBUG] Agent ${role} starting loop`);

    while (true) {
      const status = await team.getTeamStatus();
      console.log(`[DEBUG] Agent ${role} turn ${turnCount}: ${status.completedTasks}/${status.totalTasks} completed`);
      if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
        console.log(`[DEBUG] Agent ${role} all tasks done, exiting`);
        break;
      }

      if (turnCount >= maxTurnsPerAgent) {
        console.log(`[DEBUG] Agent ${role} max turns reached, exiting`);
        break;
      }

      try {
        const prompt = turnCount === 0
          ? getBootstrapPrompt(role)
          : await getContinuationPrompt(turnCount);

        console.log(`[DEBUG] Agent ${role} sending prompt (turn ${turnCount})`);
        await runtime.session.prompt(prompt);
        turnCount++;
      } catch (err: any) {
        console.error(`Agent ${role} error:`, err.message);
        // Release current task to prevent starvation
        const currentTask = await team.getMyCurrentTask(role);
        if (currentTask !== null) {
          await team.releaseTask(role, currentTask);
        }
        break;
      }
    }

    console.log(`[DEBUG] Agent ${role} loop ended after ${turnCount} turns`);
  }

  // Start all child agents (skip parent at index 0)
  const childPromises = team.runtimes.slice(1).map((runtime, idx) => {
    const role = team.roles[idx + 1];
    return runAgentLoop(runtime, role).catch(err => {
      console.error(`Agent ${role} failed:`, err);
    });
  });

  // Monitor completion and cleanup
  team.monitorInterval = setInterval(async () => {
    const status = await team.getTeamStatus();
    if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
      clearInterval(team.monitorInterval);
      team.monitorInterval = null;
    }
  }, 1000);

  try {
    await Promise.all(childPromises);
  } finally {
    if (team.monitorInterval) {
      clearInterval(team.monitorInterval);
      team.monitorInterval = null;
    }
  }
}
