/**
 * Team Context - Shared state about team progress, agent status, and team-level information
 *
 * This provides shared awareness: agents can see what others are doing, team progress,
 * current focus, blockers, and decisions.
 */

export type AgentStatus = "idle" | "working" | "waiting" | "help_requested" | "blocked" | "complete";

export interface AgentState {
  /** Agent identifier (role name) */
  id: string;
  /** Current status */
  status: AgentStatus;
  /** Current task index (if any) */
  currentTaskIndex: number | null;
  /** Current activity description */
  activity: string;
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
  /** Progress percentage (0-100) */
  progress: number;
}

export interface TaskStatus {
  /** Task index */
  index: number;
  /** Task description */
  description: string;
  /** Current assignee (agent id) */
  assignee: string | null;
  /** Task status */
  status: "pending" | "in_progress" | "completed" | "blocked" | "needs_review";
  /** When task was claimed */
  claimedAt: number | null;
  /** When task was completed */
  completedAt: number | null;
  /** Result/output from agent */
  result: string | null;
  /** Who helped with this task */
  helpers: string[];
}

export interface TeamDecision {
  id: string;
  issue: string;
  decision: string;
  rationale: string;
  makers: string[];  // agent ids involved
  timestamp: number;
}

export interface TeamBlockers {
  agentId: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  suggestedSolution?: string;
  reportedAt: number;
}

export interface TeamContext {
  // Team metadata
  teamId: string;
  createdAt: number;
  
  // Agent states (shared)
  agentStates: Map<string, AgentState>;
  
  // Task states (shared)
  taskStates: Map<number, TaskStatus>;
  
  // Team-level shared info
  teamFocus: string;
  currentPhase: string;
  
  // Decision log (append-only)
  decisions: TeamDecision[];
  
  // Active blockers
  blockers: TeamBlockers[];
  
  // Chat messages (mirrored from MessageBus for quick access)
  recentChatMessages: Array<{
    from: string;
    content: string;
    timestamp: number;
  }>;
  
  // Metrics
  tasksCompleted: number;
  totalTasks: number;
  startTime: number;
}

/**
 * TeamContextManager - Manages a shared TeamContext instance
 * All agents read/write to the same context object (via team reference)
 */
export class TeamContextManager {
  private context: TeamContext;
  
  constructor(teamId: string, totalTasks: number, initialFocus: string = "") {
    this.context = {
      teamId,
      createdAt: Date.now(),
      agentStates: new Map(),
      taskStates: new Map(),
      teamFocus: initialFocus,
      currentPhase: "initialization",
      decisions: [],
      blockers: [],
      recentChatMessages: [],
      tasksCompleted: 0,
      totalTasks,
      startTime: Date.now(),
    };
    
    // Initialize task states
    for (let i = 0; i < totalTasks; i++) {
      this.context.taskStates.set(i, {
        index: i,
        description: "",
        assignee: null,
        status: "pending",
        claimedAt: null,
        completedAt: null,
        result: null,
        helpers: [],
      });
    }
  }
  
  /**
   * Get a snapshot of current context (for agents to read)
   */
  getSnapshot(): Readonly<TeamContext> {
    return this.freezeContext();
  }
  
  /**
   * Freeze context to prevent mutation during reads
   */
  private freezeContext(): Readonly<TeamContext> {
    return {
      ...this.context,
      agentStates: new Map<string, AgentState>(this.context.agentStates),
      taskStates: new Map<number, TaskStatus>(this.context.taskStates),
      decisions: [...this.context.decisions],
      blockers: [...this.context.blockers],
      recentChatMessages: [...this.context.recentChatMessages],
    } as Readonly<TeamContext>;
  }
  
  /**
   * Update an agent's status
   */
  setAgentStatus(agentId: string, status: AgentStatus, activity?: string, progress?: number): void {
    const agentState = this.context.agentStates.get(agentId) || {
      id: agentId,
      status: "idle",
      currentTaskIndex: null,
      activity: "",
      lastHeartbeat: Date.now(),
      progress: 0,
    };
    
    agentState.status = status;
    if (activity !== undefined) agentState.activity = activity;
    if (progress !== undefined) agentState.progress = progress;
    agentState.lastHeartbeat = Date.now();
    
    this.context.agentStates.set(agentId, agentState);
  }
  
  /**
   * Assign a task to an agent
   */
  claimTask(agentId: string, taskIndex: number): boolean {
    const task = this.context.taskStates.get(taskIndex);
    if (!task || task.status !== "pending") {
      return false;
    }
    
    task.assignee = agentId;
    task.status = "in_progress";
    task.claimedAt = Date.now();
    
    // Update agent state
    this.setAgentStatus(agentId, "working", `Working on task ${taskIndex}`, 0);
    this.context.agentStates.get(agentId)!.currentTaskIndex = taskIndex;
    
    return true;
  }
  
  /**
   * Mark task as completed
   */
  completeTask(agentId: string, taskIndex: number, result: string): void {
    const task = this.context.taskStates.get(taskIndex);
    if (!task) return;
    
    task.status = "completed";
    task.completedAt = Date.now();
    task.result = result;
    
    // Update agent state
    this.setAgentStatus(agentId, "idle", "Idle after completing task", 100);
    const agentState = this.context.agentStates.get(agentId);
    if (agentState) {
      agentState.currentTaskIndex = null;
      agentState.progress = 0;
    }
    
    this.context.tasksCompleted++;
  }
  
  /**
   * Mark task as blocked/needs help
   */
  blockTask(agentId: string, taskIndex: number, description: string, severity: TeamBlockers["severity"] = "medium"): void {
    const task = this.context.taskStates.get(taskIndex);
    if (!task) return;
    
    task.status = "blocked";
    
    // Add blocker
    this.context.blockers.push({
      agentId,
      description: `Task ${taskIndex}: ${description}`,
      severity,
      reportedAt: Date.now(),
    });
    
    this.setAgentStatus(agentId, "blocked", `Blocked: ${description}`);
  }
  
  /**
   * Unblock a task
   */
  unblockTask(taskIndex: number): void {
    const task = this.context.taskStates.get(taskIndex);
    if (!task) return;
    
    task.status = "in_progress";
    
    // Remove blocker for that agent
    const agentId = task.assignee;
    if (agentId) {
      this.context.blockers = this.context.blockers.filter(
        b => !(b.agentId === agentId && b.description.includes(`Task ${taskIndex}`))
      );
      
      const agentState = this.context.agentStates.get(agentId);
      if (agentState) {
        this.setAgentStatus(agentId, "working", `Resumed work on task ${taskIndex}`);
      }
    }
  }
  
  /**
   * Record a team decision
   */
  addDecision(issue: string, decision: string, rationale: string, makers: string[]): void {
    this.context.decisions.push({
      id: `decision-${Date.now()}`,
      issue,
      decision,
      rationale,
      makers,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Set team focus/phase
   */
  setTeamFocus(focus: string, phase?: string): void {
    this.context.teamFocus = focus;
    if (phase) this.context.currentPhase = phase;
  }
  
  /**
   * Add chat message reference (called by MessageBus)
   */
  addChatMessage(from: string, content: string, timestamp: number): void {
    this.context.recentChatMessages.push({ from, content, timestamp });
    // Keep only last 100 messages
    if (this.context.recentChatMessages.length > 100) {
      this.context.recentChatMessages = this.context.recentChatMessages.slice(-100);
    }
  }
  
  /**
   * Get summary for orchestration
   */
  getTeamSummary(): {
    totalTasks: number;
    completedTasks: number;
    activeAgents: number;
    blockedAgents: number;
    currentPhase: string;
  } {
    const snapshot = this.freezeContext();
    return {
      totalTasks: snapshot.totalTasks,
      completedTasks: snapshot.tasksCompleted,
      activeAgents: Array.from(snapshot.agentStates.values()).filter(a => a.status === "working").length,
      blockedAgents: Array.from(snapshot.agentStates.values()).filter(a => a.status === "blocked").length,
      currentPhase: snapshot.currentPhase,
    };
  }
  
  /**
   * Get tasks that need help (blocked or stuck)
   */
  getStuckTasks(): Array<{ taskIndex: number; assignee: string; description: string }> {
    const snapshot = this.freezeContext();
    return Array.from(snapshot.taskStates.values())
      .filter(t => t.status === "blocked" || (t.status === "in_progress" && Date.now() - (t.claimedAt || 0) > 5 * 60 * 1000))
      .map(t => ({
        taskIndex: t.index,
        assignee: t.assignee || "unassigned",
        description: t.description,
      }));
  }
}
