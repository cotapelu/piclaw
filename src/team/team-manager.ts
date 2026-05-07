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
 * Advanced Team Operations Tool
 * Supports full collaboration features
 */
function createTeamOpsTool(team: AgentTeam): ToolDefinition {
  return {
    name: "team_ops",
    label: "Team Ops",
    description:
      "Advanced team collaboration: claim/release tasks, read/write workspace (with locking), send messages, get team status, request help, steal work.",
    parameters: {
      type: "object",
      properties: {
        // Task management
        action: {
          type: "string",
          enum: [
            "claim_task", "release_task", "steal_task", "get_my_task",
            "get_team_status", "get_stuck_tasks",
            // Workspace (with conflict resolution)
            "workspace_read", "workspace_write", "workspace_lock", "workspace_unlock", "workspace_list", "workspace_info",
            // Messaging
            "send_message", "get_messages", "broadcast", "send_direct",
            // Team context
            "get_context", "update_status", "add_decision", "report_blocker",
            // Dynamic management
            "request_help", "get_load_distribution",
          ],
          description: "Action to perform"
        },
        // Task params
        taskIndex: { type: "number", description: "Task index" },
        reason: { type: "string", description: "Reason for action (block, help, etc.)" },
        // Workspace params
        key: { type: "string", description: "Workspace key/path" },
        value: { type: "string", description: "Value to write (JSON string)" },
        lock: { type: "boolean", description: "Acquire lock on read (default false)" },
        lockToken: { type: "string", description: "Lock token from previous lock" },
        // Messaging params
        channel: { type: "string", description: "Channel name (e.g., team.chat, team.help)" },
        content: { type: "string", description: "Message content" },
        to: { type: "string", description: "Recipient agent ID (for direct messages)" },
        since: { type: "number", description: "Get messages since timestamp" },
        limit: { type: "number", description: "Limit number of messages" },
        // Context params
        status: { type: "string", enum: ["idle", "working", "waiting", "help_requested", "blocked", "complete"], description: "Agent status" },
        activity: { type: "string", description: "Activity description" },
        progress: { type: "number", description: "Progress percentage (0-100)" },
        issue: { type: "string", description: "Decision issue" },
        decision: { type: "string", description: "Decision made" },
        rationale: { type: "string", description: "Decision rationale" },
        makers: { type: "array", items: { type: "string" }, description: "Agents involved in decision" },
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
      
      try {
        switch (action) {
          // ==================== TASK MANAGEMENT ====================
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
          
          case "release_task": {
            const released = team.releaseTask(agentId, params.taskIndex);
            return { success: released } as any;
          }
          
          case "steal_task": {
            const taskIndex = team.stealTask(agentId);
            if (taskIndex !== null) {
              return {
                taskIndex,
                task: team.tasks[taskIndex],
                stolenFrom: team.getTaskAssignee(taskIndex)
              } as any;
            }
            return { taskIndex: null, message: "No stealable tasks" } as any;
          }
          
          case "get_my_task": {
            const taskIndex = team.getMyCurrentTask(agentId);
            if (taskIndex !== null) {
              return { taskIndex, task: team.tasks[taskIndex] } as any;
            }
            return { taskIndex: null } as any;
          }
          
          case "get_team_status": {
            return team.getTeamStatus() as any;
          }
          
          case "get_stuck_tasks": {
            return { stuckTasks: team.getStuckTasks() } as any;
          }
          
          // ==================== WORKSPACE (COLLABORATIVE) ====================
          case "workspace_read": {
            if (!params.key) {
              return { value: null } as any;
            }
            const result = team.getCollaborativeWorkspace().read(params.key);
            if (!result) {
              return { value: null, version: 0, locked: false } as any;
            }
            return { 
              value: result.value, 
              version: result.version,
              locked: result.locked,
              lockedBy: result.lockedBy 
            } as any;
          }
          
          case "workspace_write": {
            if (params.key === undefined || params.value === undefined) {
              return { success: false, error: "key and value required" } as any;
            }
            // Parse value if string (assume JSON)
            let parsedValue: any = params.value;
            if (typeof params.value === 'string') {
              try {
                parsedValue = JSON.parse(params.value);
              } catch (e) {
                // Keep as string if not JSON
              }
            }
            const result = await team.getCollaborativeWorkspace().write(
              params.key, parsedValue, agentId, 
              params.description || `Written by ${agentId}`
            );
            return result as any;
          }
          
          case "workspace_lock": {
            if (!params.key) {
              return { locked: false, error: "key required" } as any;
            }
            const lockResult = team.getCollaborativeWorkspace().tryLock(params.key, agentId, params.ttl);
            return { locked: lockResult.locked, lockToken: lockResult.lockToken, lockedBy: lockResult.owner } as any;
          }
          
          case "workspace_unlock": {
            if (!params.key) return { success: false } as any;
            const success = team.getCollaborativeWorkspace().releaseLock(params.key, agentId);
            return { success } as any;
          }
          
          case "workspace_list": {
            return { keys: team.getCollaborativeWorkspace().list() } as any;
          }
          
          case "workspace_info": {
            return team.getCollaborativeWorkspace().getArtifactInfo(params.key) as any;
          }
          
          // ==================== MESSAGING ====================
          case "send_message": {
            if (!params.channel || !params.content) {
              return { success: false, error: "channel and content required" } as any;
            }
            const msg = team.getMessageBus().publish({
              channel: params.channel,
              from: agentId,
              content: params.content,
              type: params.type || "chat",
            });
            return { success: true, messageId: msg.id } as any;
          }
          
          case "get_messages": {
            if (!params.channel) {
              return { messages: [] } as any;
            }
            const messages = team.getMessageBus().getMessages(params.channel, {
              limit: params.limit || 50,
              since: params.since,
            });
            return { messages } as any;
          }
          
          case "broadcast": {
            if (!params.content) {
              return { success: false, error: "content required" } as any;
            }
            team.getMessageBus().broadcast(agentId, params.content, params.type || "notification");
            return { success: true } as any;
          }
          
          case "send_direct": {
            if (!params.to || !params.content) {
              return { success: false, error: "to and content required" } as any;
            }
            team.getMessageBus().sendDirectMessage(agentId, params.to, params.content);
            return { success: true } as any;
          }
          
          // ==================== TEAM CONTEXT ====================
          case "get_context": {
            return { context: team.getContext().getSnapshot() } as any;
          }
          
          case "update_status": {
            team.getContext().setAgentStatus(
              agentId,
              params.status || "idle",
              params.activity,
              params.progress
            );
            return { success: true } as any;
          }
          
          case "add_decision": {
            if (!params.issue || !params.decision || !params.rationale) {
              return { success: false, error: "issue, decision, and rationale required" } as any;
            }
            team.getContext().addDecision(
              params.issue,
              params.decision,
              params.rationale,
              params.makers || [agentId]
            );
            return { success: true } as any;
          }
          
          case "report_blocker": {
            if (!params.reason) {
              return { success: false, error: "reason required" } as any;
            }
            const taskIndex = team.getMyCurrentTask(agentId);
            team.getContext().blockTask(agentId, taskIndex ?? -1, params.reason, params.severity || "medium");
            return { success: true } as any;
          }
          
          case "get_load_distribution": {
            return { distribution: team.getLoadDistribution() } as any;
          }
          
          case "request_help": {
            const taskIndex = team.getMyCurrentTask(agentId);
            if (taskIndex === null) {
              return { success: false, message: "No active task" } as any;
            }
            team.requestHelp(agentId, taskIndex, params.reason || "Help needed");
            return { success: true } as any;
          }
          
          default:
            return { error: `Unknown action: ${action}` } as any;
        }
      } catch (err: any) {
        return { success: false, error: err.message } as any;
      }
    },
    // Optional rendering functions could be added
  };
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
  tasks: string[] = []
  private taskStatuses: Map<number, any> = new Map();
  private agentStatuses: Map<string, any> = new Map();
  
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
    
    // Initialize collaboration components
    this.messageBus = new TeamMessageBus();
    this.conflictManager = new ConflictResolutionManager();
    this.collaborativeWorkspace = new CollaborativeWorkspace(this.conflictManager);
    this.context = new TeamContextManager("team-" + Date.now(), 0, "");
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
    this.context = new TeamContextManager("team-" + Date.now() + "-" + Date.now(), tasks.length, "");
    
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
 * Agents are empowered to:
 * - Communicate via message bus
 * - Dynamically steal work
 * - Request and provide help
 * - Lock shared artifacts
 * - Make team decisions
 */
export async function executeTeamTasks(
  team: AgentTeam,
  tasks: string[]
): Promise<void> {
  // Initialize team with enhanced context
  team.initialize(tasks);
  
  const context = team.getContext();
  context.setTeamFocus(`Working on ${tasks.length} tasks`, "collaborative_execution");
  
  // Emit team_created event
  const parentRuntime = (team as any)._parentRuntime as any;
  if (parentRuntime?.emit) {
    parentRuntime.emit("team_created", {
      teamId: team.id,
      agentCount: team.roles.length,
      taskCount: tasks.length,
      tasks: tasks
    });
  }
  
  // Enhanced bootstrap prompt that teaches collaboration
  const bootstrapTasksList = tasks.map((t, i) => `[${i}] ${t}`).join("\n");
  const bootstrapPrompt = (role: string) => `You are part of a collaborative team of AI agents.
Your role: ${role}

Team tasks (${tasks.length} total):
${bootstrapTasksList}

🚀 COLLABORATION RULES:

1. TASK MANAGEMENT:
   - Use team_ops with action="claim_task" to get an unassigned task
   - Use action="release_task" if you cannot complete your task
   - Use action="steal_task" to take over a stuck/blocked task
   - Use action="get_my_task" to see what you're working on
   - Use action="get_team_status" to see overall progress

2. COMMUNICATION (IMPORTANT):
   - Use action="send_message" with channel="team.chat" to chat with team
   - Use action="send_direct" to message a specific agent
   - Use action="get_messages" to check for new messages (poll every few turns)
   - Use action="broadcast" to announce to all agents
   - Use channel="team.help" to request assistance

3. SHARED ARTIFACTS (with locking):
   - Use action="workspace_read" to read shared data
   - Use action="workspace_lock" before long write operations
   - Use action="workspace_write" to update shared artifacts
   - Use action="workspace_unlock" when done
   - Use action="workspace_info" to see if someone else has it locked
   - Respect locks! Don't overwrite other agents' work.

4. STATUS & COORDINATION:
   - Use action="update_status" to tell the team what you're doing
   - Use action="report_blocker" if you're stuck
   - Use action="request_help" to ask for assistance explicitly
   - Use action="get_load_distribution" to see who's busy
   - Use action="get_stuck_tasks" to find tasks needing help

5. TEAM DECISIONS:
   - Use action="add_decision" to record important decisions
   - Use action="get_context" to see team decisions and status

💡 Best practices:
   - Announce when you start/finish tasks
   - Help teammates who are blocked
   - Steal work if you're idle and others are overloaded
   - Lock shared files before editing (avoid conflicts)
   - Communicate early if you need help
   - Check team.chat regularly for messages

Start by: 
1. Check team status: team_ops(action="get_team_status")
2. Claim a task: team_ops(action="claim_task")
3. Announce your intent: team_ops(action="send_message", channel="team.chat", content="Starting task X")
4. Do the work
5. Report result: team_ops(action="report_result", taskIndex=X, result="...")

Let's collaborate!`;

  // Send bootstrap prompt to all child agents (excluding parent)
  await Promise.all(
    team.runtimes.slice(1).map(async (runtime, idx) => {
      const actualIdx = idx + 1;
      const role = team.roles[actualIdx];
      const personalizedPrompt = bootstrapPrompt(role);
      try {
        await runtime.session.prompt(personalizedPrompt);
      } catch (err) {
        console.error(`Failed to prompt agent ${role}:`, err);
      }
    })
  );

  // Start background monitor to emit progress events
  const monitorInterval = setInterval(() => {
    const summary = team.getContext().getTeamSummary();
    const parentRuntime = (team as any)._parentRuntime as any;
    
    // Emit progress event
    if (parentRuntime?.emit) {
      parentRuntime.emit("team_progress", {
        teamId: team.id,
        completed: summary.completedTasks,
        total: summary.totalTasks,
        activeAgents: summary.activeAgents,
      });
    }
    
    if (summary.completedTasks === summary.totalTasks) {
      clearInterval(monitorInterval);
      // Emit completion event with results
      if (parentRuntime?.emit) {
        const results = team.getResults();
        parentRuntime.emit("team_completed", {
          teamId: team.id,
          results,
          status: team.getTeamStatus(),
        });
      }
    }
  }, 2000);
  
  // Return void — team runs asynchronously
  return;
}
