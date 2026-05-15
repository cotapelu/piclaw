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
} from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "../config/config-manager.js";
import { SharedWorkspace } from "./workspace.js";
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
  private workspace: SharedWorkspace;
  private messageBus: Map<string, Array<{ from: string; content: string; timestamp: number }>> = new Map();
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
    this.publishMessage(channel, 'parent', content);
  }

  getMessages(channel: string, limit?: number): Array<{ from: string; content: string; timestamp: number }> {
    const msgs = this.messageBus.get(channel) || [];
    return limit ? msgs.slice(-limit) : msgs;
  }

  publishMessage(channel: string, from: string, content: string): void {
    if (!this.messageBus.has(channel)) {
      this.messageBus.set(channel, []);
    }
    this.messageBus.get(channel)!.push({ from, content, timestamp: Date.now() });
  }

  getTeamStatus() {
    return {
      agents: Array.from(this.agentStatuses.entries()).map(([id, status]) => ({ id, ...status })),
      tasks: Array.from(this.taskStatuses.entries()).map(([idx, status]) => ({ index: idx, ...status })),
      completedTasks: Array.from(this.taskStatuses.values()).filter(t => t.status === 'completed').length,
      totalTasks: this.tasks.length,
    };
  }

  getMyCurrentTask(agentId: string): number | null {
    return this.agentStatuses.get(agentId)?.currentTaskIndex ?? null;
  }

  claimTask(agentId: string): number | null {
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.taskStatuses.get(i);
      if (task && task.status === 'pending') {
        task.assignee = agentId;
        task.status = 'in_progress';
        this.agentStatuses.set(agentId, { currentTaskIndex: i, status: 'working' });
        return i;
      }
    }
    return null;
  }

  releaseTask(agentId: string, taskIndex: number): boolean {
    const task = this.taskStatuses.get(taskIndex);
    if (!task || task.assignee !== agentId) {
      return false;
    }
    task.assignee = null;
    task.status = 'pending';
    this.agentStatuses.set(agentId, { currentTaskIndex: null, status: 'idle' });
    return true;
  }

  reportResult(taskIndex: number, result: string): void {
    const task = this.taskStatuses.get(taskIndex);
    if (!task) return;
    task.status = 'completed';
    task.result = result;
    const agentId = task.assignee;
    if (agentId) {
      const status = this.agentStatuses.get(agentId);
      if (status) {
        status.currentTaskIndex = null;
        status.status = 'idle';
      }
    }
  }

  completeTask(agentId: string, taskIndex: number, result: string): void {
    // Alias for reportResult but with agentId (used by team_ops)
    const task = this.taskStatuses.get(taskIndex);
    if (!task) return;
    if (task.assignee !== agentId) return; // not assigned to this agent
    task.status = 'completed';
    task.result = result;
    const status = this.agentStatuses.get(agentId);
    if (status) {
      status.currentTaskIndex = null;
      status.status = 'idle';
    }
  }

  getResults(): string[] {
    const results: string[] = new Array(this.tasks.length).fill('');
    this.taskStatuses.forEach((task, idx) => {
      results[idx] = task.result;
    });
    return results;
  }

  async waitForCompletion(): Promise<void> {
    while (true) {
      const summary = this.getTeamStatus();
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
    this.size = this.runtimes.length;
  }

  initialize(tasks: string[]): void {
    this.tasks = tasks;
    this.taskStatuses.clear();
    for (let i = 0; i < tasks.length; i++) {
      this.taskStatuses.set(i, { assignee: null, status: 'pending', result: '' });
    }
    this.messageBus.clear();
    this.workspace.clear();
    this.agentStatuses.clear();
    for (const role of this.roles) {
      this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
    }
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
  team.initialize(tasks);

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

  const getContinuationPrompt = (turnCount: number) => {
    const status = team.getTeamStatus();
    const recentMessages = team.getMessages("team.chat", 5)
      .map(m => `[${m.from}]: ${m.content}`)
      .join("\n");

    return `Turn ${turnCount + 1}. Continue.

Progress: ${status.completedTasks}/${status.totalTasks} tasks completed.
${recentMessages ? `\nRecent messages:\n${recentMessages}\n` : ""}

Use team_ops to continue. If all tasks done, finish up.`;
  };

  async function runAgentLoop(runtime: AgentSessionRuntime, role: string): Promise<void> {
    let turnCount = 0;
    const maxTurnsPerAgent = 50;

    while (true) {
      const status = team.getTeamStatus();
      if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
        break;
      }

      if (turnCount >= maxTurnsPerAgent) break;

      try {
        const prompt = turnCount === 0
          ? getBootstrapPrompt(role)
          : getContinuationPrompt(turnCount);

        await runtime.session.prompt(prompt);
        turnCount++;
      } catch (err: any) {
        console.error(`Agent ${role} error:`, err.message);
        break;
      }
    }
  }

  // Start all child agents (skip parent at index 0)
  const childPromises = team.runtimes.slice(1).map((runtime, idx) => {
    const role = team.roles[idx + 1];
    return runAgentLoop(runtime, role).catch(err => {
      console.error(`Agent ${role} failed:`, err);
    });
  });

  // Monitor completion
  team.monitorInterval = setInterval(() => {
    const status = team.getTeamStatus();
    if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
      clearInterval(team.monitorInterval);
      team.monitorInterval = null;
    }
  }, 1000);

  await Promise.all(childPromises);
}
