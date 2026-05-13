/**
 * Team Metrics Collector
 *
 * Collects performance and operational metrics for team collaboration.
 * Helps monitor team efficiency, conflicts, and resource distribution.
 */

export interface TeamMetrics {
  // Timing
  startTime: number;
  endTime?: number;

  // Task metrics
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  taskCompletionTimes: number[]; // milliseconds per task

  // Agent metrics
  agentStats: Map<string, AgentMetrics>;

  // Conflict metrics
  workspaceConflicts: number;
  taskConflicts: number;
  lockWaitTimes: number[];

  // Work stealing
  theftCount: number;
  successfulSteals: number;
  requestHelpCount: number;

  // Message bus
  messagesSent: number;
  messagesReceived: number;
  channelsUsed: Set<string>;

  // Resource usage
  workspaceReads: number;
  workspaceWrites: number;
  workspaceLocks: number;
}

export interface AgentMetrics {
  agentId: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalWorkTime: number; // ms
  avgCompletionTime: number;
  messagesSent: number;
  messagesReceived: number;
  workspaceAccessCount: number;
  helpRequests: number;
  timesHelped: number;
}

/**
 * TeamMetricsCollector - Singleton metrics collector
 */
export class TeamMetricsCollector {
  private static instance: TeamMetricsCollector | null = null;
  private metrics: TeamMetrics;

  private constructor() {
    this.metrics = {
      startTime: Date.now(),
      endTime: undefined,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      taskCompletionTimes: [],
      agentStats: new Map(),
      workspaceConflicts: 0,
      taskConflicts: 0,
      lockWaitTimes: [],
      theftCount: 0,
      successfulSteals: 0,
      requestHelpCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      channelsUsed: new Set(),
      workspaceReads: 0,
      workspaceWrites: 0,
      workspaceLocks: 0,
    };
  }

  static getInstance(): TeamMetricsCollector {
    if (!TeamMetricsCollector.instance) {
      TeamMetricsCollector.instance = new TeamMetricsCollector();
    }
    return TeamMetricsCollector.instance;
  }

  reset(): void {
    this.metrics = {
      startTime: Date.now(),
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      taskCompletionTimes: [],
      agentStats: new Map(),
      workspaceConflicts: 0,
      taskConflicts: 0,
      lockWaitTimes: [],
      theftCount: 0,
      successfulSteals: 0,
      requestHelpCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      channelsUsed: new Set(),
      workspaceReads: 0,
      workspaceWrites: 0,
      workspaceLocks: 0,
    };
  }

  // Task tracking
  setTotalTasks(count: number): void {
    this.metrics.totalTasks = count;
  }

  recordTaskCompletion(agentId: string, durationMs: number): void {
    this.metrics.completedTasks++;
    this.metrics.taskCompletionTimes.push(durationMs);

    const agent = this.getOrCreateAgent(agentId);
    agent.tasksCompleted++;
    agent.totalWorkTime += durationMs;
    agent.avgCompletionTime = agent.totalWorkTime / agent.tasksCompleted;
  }

  recordTaskFailed(agentId: string): void {
    this.metrics.failedTasks++;
    const agent = this.getOrCreateAgent(agentId);
    agent.tasksFailed++;
  }

  // Agent tracking
  private getOrCreateAgent(agentId: string): AgentMetrics {
    if (!this.metrics.agentStats.has(agentId)) {
      this.metrics.agentStats.set(agentId, {
        agentId,
        tasksCompleted: 0,
        tasksFailed: 0,
        totalWorkTime: 0,
        avgCompletionTime: 0,
        messagesSent: 0,
        messagesReceived: 0,
        workspaceAccessCount: 0,
        helpRequests: 0,
        timesHelped: 0,
      });
    }
    return this.metrics.agentStats.get(agentId)!;
  }

  // Messaging
  recordMessageSent(agentId?: string, channel?: string): void {
    this.metrics.messagesSent++;
    if (agentId) {
      const agent = this.getOrCreateAgent(agentId);
      agent.messagesSent++;
    }
    if (channel) {
      this.metrics.channelsUsed.add(channel);
    }
  }

  recordMessageReceived(agentId?: string): void {
    this.metrics.messagesReceived++;
    if (agentId) {
      const agent = this.getOrCreateAgent(agentId);
      agent.messagesReceived++;
    }
  }

  // Workspace operations
  recordWorkspaceRead(agentId?: string): void {
    this.metrics.workspaceReads++;
    if (agentId) {
      const agent = this.getOrCreateAgent(agentId);
      agent.workspaceAccessCount++;
    }
  }

  recordWorkspaceWrite(agentId?: string): void {
    this.metrics.workspaceWrites++;
    if (agentId) {
      const agent = this.getOrCreateAgent(agentId);
      agent.workspaceAccessCount++;
    }
  }

  recordWorkspaceLock(agentId?: string): void {
    this.metrics.workspaceLocks++;
  }

  // Conflicts
  recordWorkspaceConflict(): void {
    this.metrics.workspaceConflicts++;
  }

  recordTaskConflict(): void {
    this.metrics.taskConflicts++;
  }

  recordLockWaitTime(ms: number): void {
    this.metrics.lockWaitTimes.push(ms);
  }

  // Work stealing
  recordTheft(): void {
    this.metrics.theftCount++;
  }

  recordSuccessfulSteal(): void {
    this.metrics.successfulSteals++;
  }

  // Help requests
  recordHelpRequest(agentId: string): void {
    this.metrics.requestHelpCount++;
    const agent = this.getOrCreateAgent(agentId);
    agent.helpRequests++;
  }

  recordTimesHelped(agentId: string): void {
    const agent = this.getOrCreateAgent(agentId);
    agent.timesHelped++;
  }

  // Finish team run
  complete(): void {
    this.metrics.endTime = Date.now();
  }

  // Get snapshot
  getSnapshot(): Readonly<TeamMetrics> {
    return Object.freeze({
      ...this.metrics,
      agentStats: new Map(this.metrics.agentStats),
      channelsUsed: new Set(this.metrics.channelsUsed),
      taskCompletionTimes: [...this.metrics.taskCompletionTimes],
      lockWaitTimes: [...this.metrics.lockWaitTimes],
    }) as Readonly<TeamMetrics>;
  }

  // Generate summary string
  generateSummary(): string {
    const snap = this.getSnapshot();
    const duration = (snap.endTime || Date.now()) - snap.startTime;
    const avgTaskTime = snap.completedTasks > 0
      ? snap.taskCompletionTimes.reduce((a, b) => a + b, 0) / snap.completedTasks
      : 0;

    let summary = `📊 Team Metrics Report\n`;
    summary += `═${'═'.repeat(40)}\n`;
    summary += `Duration: ${(duration / 1000).toFixed(1)}s\n`;
    summary += `Tasks: ${snap.completedTasks}/${snap.totalTasks} completed (${snap.failedTasks} failed)\n`;
    summary += `Avg task time: ${(avgTaskTime / 1000).toFixed(1)}s\n`;
    summary += `\nAgent Stats:\n`;

    for (const [agentId, stats] of snap.agentStats.entries()) {
      summary += `  • ${agentId}: ${stats.tasksCompleted} tasks, `;
      summary += `${(stats.avgCompletionTime / 1000).toFixed(1)}s avg, `;
      summary += `${stats.messagesSent} msgs sent\n`;
    }

    summary += `\nCollaboration:\n`;
    summary += `  • Messages: ${snap.messagesSent} sent, ${snap.messagesReceived} received\n`;
    summary += `  • Workspace: ${snap.workspaceReads} reads, ${snap.workspaceWrites} writes, ${snap.workspaceConflicts} conflicts\n`;
    summary += `  • Work stealing: ${snap.theftCount} thefts (${snap.successfulSteals} successful)\n`;
    summary += `  • Help requests: ${snap.requestHelpCount}\n`;
    summary += `  • Channels used: ${Array.from(snap.channelsUsed).join(', ') || 'none'}\n`;

    return summary;
  }

  // Export to JSON for analysis
  toJSON(): any {
    const snap = this.getSnapshot();
    return {
      startTime: snap.startTime,
      endTime: snap.endTime,
      duration: snap.endTime ? snap.endTime - snap.startTime : undefined,
      tasks: {
        total: snap.totalTasks,
        completed: snap.completedTasks,
        failed: snap.failedTasks,
        avgCompletionTimeMs: snap.completedTasks > 0
          ? snap.taskCompletionTimes.reduce((a, b) => a + b, 0) / snap.completedTasks
          : 0,
      },
      agents: Array.from(snap.agentStats.values()).map(a => ({
        id: a.agentId,
        tasksCompleted: a.tasksCompleted,
        tasksFailed: a.tasksFailed,
        avgCompletionTimeMs: a.avgCompletionTime,
        messagesSent: a.messagesSent,
        messagesReceived: a.messagesReceived,
        workspaceAccessCount: a.workspaceAccessCount,
      })),
      collaboration: {
        workspaceConflicts: snap.workspaceConflicts,
        taskConflicts: snap.taskConflicts,
        theftCount: snap.theftCount,
        successfulSteals: snap.successfulSteals,
        requestHelpCount: snap.requestHelpCount,
      },
      messaging: {
        totalSent: snap.messagesSent,
        totalReceived: snap.messagesReceived,
        channels: Array.from(snap.channelsUsed),
      },
    };
  }
}

/**
 * Integration hook for team manager
 * Call these methods at appropriate points in agent lifecycle
 */
export const teamMetrics = {
  recordTaskStart: (agentId: string, taskIndex: number) => {
    // Could track per-task start times if needed
  },

  recordTaskEnd: (agentId: string, taskIndex: number, startTime: number, success: boolean) => {
    const collector = TeamMetricsCollector.getInstance();
    const duration = Date.now() - startTime;
    if (success) {
      collector.recordTaskCompletion(agentId, duration);
    } else {
      collector.recordTaskFailed(agentId);
    }
  },

  recordMessage: (direction: 'sent' | 'received', agentId?: string, channel?: string) => {
    const collector = TeamMetricsCollector.getInstance();
    if (direction === 'sent') {
      collector.recordMessageSent(agentId, channel);
    } else {
      collector.recordMessageReceived(agentId);
    }
  },

  recordWorkspaceOp: (op: 'read' | 'write' | 'lock', agentId?: string) => {
    const collector = TeamMetricsCollector.getInstance();
    switch (op) {
      case 'read':
        collector.recordWorkspaceRead(agentId);
        break;
      case 'write':
        collector.recordWorkspaceWrite(agentId);
        break;
      case 'lock':
        collector.recordWorkspaceLock(agentId);
        break;
    }
  },

  recordConflict: (type: 'workspace' | 'task') => {
    const collector = TeamMetricsCollector.getInstance();
    if (type === 'workspace') {
      collector.recordWorkspaceConflict();
    } else {
      collector.recordTaskConflict();
    }
  },

  recordSteal: (success: boolean) => {
    const collector = TeamMetricsCollector.getInstance();
    collector.recordTheft();
    if (success) collector.recordSuccessfulSteal();
  },

  recordHelp: (agentId: string, isHelper?: boolean) => {
    const collector = TeamMetricsCollector.getInstance();
    if (isHelper) {
      collector.recordTimesHelped(agentId);
    } else {
      collector.recordHelpRequest(agentId);
    }
  },

  getSummary: () => {
    return TeamMetricsCollector.getInstance().generateSummary();
  },

  getJSON: () => {
    return TeamMetricsCollector.getInstance().toJSON();
  },

  reset: () => {
    TeamMetricsCollector.getInstance().reset();
  },

  complete: () => {
    TeamMetricsCollector.getInstance().complete();
  },
};
