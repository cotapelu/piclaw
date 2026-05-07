/**
 * AgentSession Team Manager
 * Simple shared-context team for parallel execution
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
 * Team Operations Tool
 * Allows agents to collaborate: claim tasks, share workspace, report results
 */
function createTeamOpsTool(team: AgentTeam): ToolDefinition {
  return {
    name: "team_ops",
    label: "Team Ops",
    description:
      "Team collaboration operations: claim_task, report_result, workspace_read, workspace_write, workspace_list.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["claim_task", "report_result", "workspace_read", "workspace_write", "workspace_list"],
          description: "Action to perform"
        },
        taskIndex: { type: "number", description: "Task index (for report_result)" },
        result: { type: "string", description: "Result string (for report_result)" },
        key: { type: "string", description: "Workspace key" },
        value: { type: "string", description: "Workspace value (for workspace_write)" }
      },
      required: ["action"]
    },
    async execute(params: any, ctx: any) {
      const agentRuntime = ctx.runtime as AgentSessionRuntime;
      const agentId = team.getAgentId(agentRuntime);
      if (!agentId) {
        return { error: "Unknown agent" } as any;
      }

      const { action } = params;
      switch (action) {
        case "claim_task": {
          const taskIndex = team.claimTask(agentId);
          if (taskIndex !== null) {
            return {
              taskIndex,
              task: team.tasks[taskIndex],
              assignedTo: agentId
            } as any;
          }
          return { taskIndex: null, message: "No pending tasks" } as any;
        }
        case "report_result": {
          if (params.taskIndex === undefined || params.result === undefined) {
            return { success: false, error: "taskIndex and result required" } as any;
          }
          team.reportResult(params.taskIndex, params.result);
          return { success: true } as any;
        }
        case "workspace_read": {
          if (!params.key) {
            return { value: null } as any;
          }
          return { value: team.getWorkspace().get(params.key) } as any;
        }
        case "workspace_write": {
          if (params.key === undefined || params.value === undefined) {
            return { success: false, error: "key and value required" } as any;
          }
          team.getWorkspace().set(params.key, params.value, agentId);
          return { success: true } as any;
        }
        case "workspace_list": {
          return { keys: team.getWorkspace().list() } as any;
        }
        default:
          return { error: `Unknown action: ${action}` } as any;
      }
    }
  };
}

/**
 * AgentTeam: wrapper for collaborative team with shared workspace and task coordination
 */
export class AgentTeam implements AgentTeamRuntime {
  runtimes: AgentSessionRuntime[] = [];
  roles: string[] = [];
  size = 0;
  dispose: () => Promise<void>;

  // Internal state for self-organization
  workspace: SharedWorkspace = new SharedWorkspace();
  tasks: string[] = [];
  private assignments: Map<number, string> = new Map(); // task index -> agentId
  private results: (string | null)[] = [];
  private agentIdMap: Map<AgentSessionRuntime, string> = new Map();
  private completionResolvers: Array<() => void> = [];
  private _isComplete: boolean = false;

  constructor() {
    this.dispose = async () => {
      await Promise.allSettled(
        this.runtimes.slice(1).map(rt =>
          rt.dispose().catch(err =>
            console.error("Failed to dispose child agent:", err)
          )
        )
      );
    };
  }

  /** Register a runtime with its role */
  registerRuntime(runtime: AgentSessionRuntime, role: string): void {
    this.runtimes.push(runtime);
    this.roles.push(role);
    this.agentIdMap.set(runtime, role);
    this.size = this.runtimes.length;
  }

  /** Initialize tasks for this team */
  initialize(tasks: string[]): void {
    this.tasks = tasks;
    this.results = new Array(tasks.length).fill(null);
    this.assignments.clear();
    this._isComplete = false;
  }

  /** Get agent ID from runtime */
  getAgentId(runtime: AgentSessionRuntime): string | undefined {
    return this.agentIdMap.get(runtime);
  }

  /** Claim a pending task (atomic) */
  claimTask(agentId: string): number | null {
    for (let i = 0; i < this.tasks.length; i++) {
      if (!this.assignments.has(i)) {
        this.assignments.set(i, agentId);
        return i;
      }
    }
    return null;
  }

  /** Report result for a task */
  reportResult(taskIndex: number, result: string): void {
    this.results[taskIndex] = result;
    this.checkCompletion();
  }

  /** Check if all tasks are done */
  private checkCompletion(): void {
    if (!this._isComplete && this.results.every(r => r !== null)) {
      this._isComplete = true;
      this.completionResolvers.forEach(resolve => resolve());
    }
  }

  /** Wait until all tasks complete */
  async waitForCompletion(): Promise<void> {
    if (this._isComplete) return;
    return new Promise(resolve => {
      this.completionResolvers.push(resolve);
    });
  }

  /** Get all results in order */
  getResults(): string[] {
    return this.results as string[];
  }

  /** Get workspace */
  getWorkspace(): SharedWorkspace {
    return this.workspace;
  }
}


/**
 * Create team with shared context - simple approach
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

  return team;
}

export async function executeTeamTasks(
  team: AgentTeam,
  tasks: string[]
): Promise<string[]> {
  // Initialize team tasks
  team.initialize(tasks);

  // Send bootstrap prompt to each child agent
  const bootstrapTasksList = tasks.map((t, i) => `[${i}] ${t}`).join("\n");
  const bootstrapPrompt = (role: string) => `You are part of a self-organizing team.
Your role: ${role}

Team tasks:
${bootstrapTasksList}

Collaboration rules:
1. Use team_ops tool with action="claim_task" to get an unassigned task index
2. Use workspace_read/write to share information (keys like "db.schema", "api.endpoints")
3. After completing a task, use team_ops action="report_result" with task index and your output
4. Continue claiming tasks until none remain
5. Use workspace to communicate with other agents

Start by calling team_ops with action="claim_task".`;

  // Send bootstrap prompt to all child agents (excluding parent)
  await Promise.all(
    team.runtimes.slice(1).map(async (runtime, idx) => {
      const actualIdx = idx + 1; // because slice(1)
      const role = team.roles[actualIdx];
      const personalizedPrompt = bootstrapPrompt(role);
      try {
        await runtime.session.prompt(personalizedPrompt);
      } catch (err) {
        console.error(`Failed to prompt agent ${role}:`, err);
      }
    })
  );

  // Wait for all tasks to complete
  await team.waitForCompletion();

  // Return results in task order
  return team.getResults();
}