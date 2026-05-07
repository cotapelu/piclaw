import { describe, it, expect, beforeEach } from "vitest";
import { TeamContextManager } from "../../team/team-context.js";

describe("TeamContextManager", () => {
  let context: TeamContextManager;
  
  beforeEach(() => {
    context = new TeamContextManager("test-team", 3, "Test phase");
  });
  
  describe("initialization", () => {
    it("should initialize with correct metadata", () => {
      const snapshot = context.getSnapshot();
      expect(snapshot.teamId).toBe("test-team");
      expect(snapshot.totalTasks).toBe(3);
      expect(snapshot.currentPhase).toBe("Test phase");
      expect(snapshot.tasksCompleted).toBe(0);
      expect(snapshot.startTime).toBeDefined();
    });
    
    it("should initialize all tasks as pending with correct indices", () => {
      const snapshot = context.getSnapshot();
      const tasks = Array.from(snapshot.taskStates.values());
      expect(tasks.length).toBe(3);
      
      tasks.forEach((task, idx) => {
        expect(task.index).toBe(idx);
        expect(task.status).toBe("pending");
        expect(task.assignee).toBeNull();
        expect(task.claimedAt).toBeNull();
        expect(task.completedAt).toBeNull();
        expect(task.result).toBeNull();
        expect(task.helpers).toEqual([]);
      });
    });
    
    it("should initialize empty agent states map", () => {
      const snapshot = context.getSnapshot();
      expect(snapshot.agentStates.size).toBe(0);
    });
    
    it("should initialize empty decisions and blockers", () => {
      const snapshot = context.getSnapshot();
      expect(snapshot.decisions).toEqual([]);
      expect(snapshot.blockers).toEqual([]);
    });
  });
  
  describe("agent status management", () => {
    it("should set agent status with all fields", () => {
      context.setAgentStatus("agent-1", "working", "Working on task 0", 50);
      const snapshot = context.getSnapshot();
      const agent = snapshot.agentStates.get("agent-1");
      
      expect(agent).toBeDefined();
      expect(agent!.id).toBe("agent-1");
      expect(agent!.status).toBe("working");
      expect(agent!.activity).toBe("Working on task 0");
      expect(agent!.progress).toBe(50);
      expect(agent!.currentTaskIndex).toBeNull();
      expect(agent!.lastHeartbeat).toBeGreaterThan(0);
    });
    
    it("should update agent status incrementally", () => {
      context.setAgentStatus("agent-1", "idle");
      context.setAgentStatus("agent-1", "working", "Starting task");
      context.setAgentStatus("agent-1", "working", "Deep work", 75);
      
      const snapshot = context.getSnapshot();
      const agent = snapshot.agentStates.get("agent-1");
      
      expect(agent!.status).toBe("working");
      expect(agent!.activity).toBe("Deep work");
      expect(agent!.progress).toBe(75);
    });
    
    it("should auto-initialize unknown agents", () => {
      // Calling setAgentStatus for new agent should work
      context.setAgentStatus("new-agent", "blocked", "Waiting for data");
      const snapshot = context.getSnapshot();
      expect(snapshot.agentStates.has("new-agent")).toBe(true);
    });
  });
  
  describe("task claiming", () => {
    beforeEach(() => {
      context.setAgentStatus("agent-1", "idle");
    });
    
    it("should claim pending task successfully", () => {
      const claimed = context.claimTask("agent-1", 0);
      expect(claimed).toBe(true);
      
      const snapshot = context.getSnapshot();
      const task = snapshot.taskStates.get(0);
      expect(task!.assignee).toBe("agent-1");
      expect(task!.status).toBe("in_progress");
      expect(task!.claimedAt).toBeDefined();
      
      const agent = snapshot.agentStates.get("agent-1");
      expect(agent!.currentTaskIndex).toBe(0);
      expect(agent!.status).toBe("working");
    });
    
    it("should not allow claiming non-pending task", () => {
      // First claim
      context.claimTask("agent-1", 0);
      
      // Try to claim same task again
      const claimed = context.claimTask("agent-2", 0);
      expect(claimed).toBe(false);
      
      // Try to claim completed task
      context.completeTask("agent-1", 0, "Done");
      const claimed2 = context.claimTask("agent-2", 0);
      expect(claimed2).toBe(false);
    });
    
    it("should allow multiple agents to claim different tasks", () => {
      context.setAgentStatus("agent-2", "idle");
      
      expect(context.claimTask("agent-1", 0)).toBe(true);
      expect(context.claimTask("agent-2", 1)).toBe(true);
      expect(context.claimTask("agent-1", 2)).toBe(true);
      
      const snapshot = context.getSnapshot();
      expect(snapshot.taskStates.get(0)!.assignee).toBe("agent-1");
      expect(snapshot.taskStates.get(1)!.assignee).toBe("agent-2");
      expect(snapshot.taskStates.get(2)!.assignee).toBe("agent-1");
    });
  });
  
  describe("task completion", () => {
    beforeEach(() => {
      context.setAgentStatus("agent-1", "idle");
      context.claimTask("agent-1", 0);
    });
    
    it("should mark task as completed with result", () => {
      context.completeTask("agent-1", 0, "Analysis: 42 files processed");
      
      const snapshot = context.getSnapshot();
      expect(snapshot.tasksCompleted).toBe(1);
      
      const task = snapshot.taskStates.get(0);
      expect(task!.status).toBe("completed");
      expect(task!.result).toBe("Analysis: 42 files processed");
      expect(task!.completedAt).toBeDefined();
      
      const agent = snapshot.agentStates.get("agent-1");
      expect(agent!.status).toBe("idle");
      expect(agent!.currentTaskIndex).toBeNull();
    });
    
    it("should increment tasksCompleted correctly", () => {
      context.completeTask("agent-1", 0, "Result 1");
      expect(context.getSnapshot().tasksCompleted).toBe(1);
      
      context.claimTask("agent-1", 1);
      context.completeTask("agent-1", 1, "Result 2");
      expect(context.getSnapshot().tasksCompleted).toBe(2);
    });
  });
  
  describe("blocking and unblocking", () => {
    beforeEach(() => {
      context.setAgentStatus("agent-1", "idle");
      context.claimTask("agent-1", 0);
    });
    
    it("should block task and add blocker", () => {
      context.blockTask("agent-1", 0, "Waiting for DB connection", "high");
      
      const snapshot = context.getSnapshot();
      const task = snapshot.taskStates.get(0);
      expect(task!.status).toBe("blocked");
      
      const blockers = snapshot.blockers;
      expect(blockers.length).toBe(1);
      expect(blockers[0].agentId).toBe("agent-1");
      expect(blockers[0].description).toContain("Task 0");
      expect(blockers[0].severity).toBe("high");
    });
    
    it("should unblock task", () => {
      context.blockTask("agent-1", 0, "Stuck");
      context.unblockTask(0);
      
      const snapshot = context.getSnapshot();
      expect(snapshot.taskStates.get(0)!.status).toBe("in_progress");
      expect(snapshot.blockers).toHaveLength(0);
      
      const agent = snapshot.agentStates.get("agent-1");
      expect(agent!.status).toBe("working");
    });
  });
  
  describe("decisions", () => {
    it("should add decision with all fields", () => {
      context.addDecision(
        "Use TypeScript",
        "Yes, use TypeScript",
        "Better type safety and DX",
        ["agent-1", "agent-2"]
      );
      
      const snapshot = context.getSnapshot();
      expect(snapshot.decisions).toHaveLength(1);
      
      const decision = snapshot.decisions[0];
      expect(decision.issue).toBe("Use TypeScript");
      expect(decision.decision).toBe("Yes, use TypeScript");
      expect(decision.rationale).toBe("Better type safety and DX");
      expect(decision.makers).toContain("agent-1");
      expect(decision.makers).toContain("agent-2");
      expect(decision.id).toMatch(/^decision-\d+$/);
      expect(decision.timestamp).toBeGreaterThan(0);
    });
  });
  
  describe("snapshot isolation", () => {
    it("should return immutable snapshot", () => {
      context.setAgentStatus("agent-1", "working");
      const snapshot = context.getSnapshot();
      
      // Try to modify snapshot (should not affect original)
      const agent = snapshot.agentStates.get("agent-1")!;

      agent.status = "idle";
      
      // Original should be unchanged
      const newSnapshot = context.getSnapshot();
      expect(newSnapshot.agentStates.get("agent-1")!.status).toBe("working");
    });
  });
  
  describe("team focus and phase", () => {
    it("should set team focus and phase", () => {
      context.setTeamFocus("Implementing authentication", "security_work");
      
      const snapshot = context.getSnapshot();
      expect(snapshot.teamFocus).toBe("Implementing authentication");
      expect(snapshot.currentPhase).toBe("security_work");
    });
  });
  
  describe("stuck tasks detection", () => {
    it("should identify blocked tasks", () => {
      context.setAgentStatus("agent-1", "idle");
      context.claimTask("agent-1", 0);
      context.blockTask("agent-1", 0, "Need help", "medium");
      
      const stuckTasks = context.getStuckTasks();
      expect(stuckTasks).toHaveLength(1);
      expect(stuckTasks[0].taskIndex).toBe(0);
      expect(stuckTasks[0].assignee).toBe("agent-1");
    });
    
    it("should not include non-blocked tasks", () => {
      context.setAgentStatus("agent-1", "idle");
      context.claimTask("agent-1", 0);
      // Don't block
      
      const stuckTasks = context.getStuckTasks();
      expect(stuckTasks).toHaveLength(0);
    });
  });
  
  describe("team summary", () => {
    it("should provide accurate summary", () => {
      context.setAgentStatus("agent-1", "idle");
      context.setAgentStatus("agent-2", "working");
      
      context.claimTask("agent-1", 0);
      context.claimTask("agent-2", 1);
      context.completeTask("agent-2", 1, "Done");
      
      const summary = context.getTeamSummary();
      expect(summary.totalTasks).toBe(3);
      expect(summary.completedTasks).toBe(1);
      expect(summary.activeAgents).toBe(1); // agent-1 still working on task 0
      expect(summary.currentPhase).toBe("Test phase");
    });
  });
});
