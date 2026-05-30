/**
 * Tests for AgentSession Team functionality
 */
import { describe, it, expect } from "vitest";
import { bootPiclawTeam, executeTeamTasks } from "../extensions/team/team-manager.js";
import { bootPiclaw } from "../piclaw-core.js";

describe("AgentSession Team", () => {
  it("should create team with parent + children", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, {
      teamSize: 2,
      teamRoles: ["coder", "tester"],
    });

    expect(team.size).toBe(3);
    expect(team.roles).toEqual(["parent", "coder", "tester"]);

    await team.dispose();
    await parent.dispose();
  });

  it("should share session manager", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 2 });
    console.log('child0 sessionManager:', team.runtimes[0].session.sessionManager);
    console.log('child1 sessionManager:', team.runtimes[1].session.sessionManager);
    console.log('same ref?', team.runtimes[0].session.sessionManager === team.runtimes[1].session.sessionManager);
    expect(team.runtimes[0].session.sessionManager)
      .toBe(team.runtimes[1].session.sessionManager);

    await team.dispose();
    await parent.dispose();
  });

  it("should use same codebase", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 2 });
    console.log('parent:', parent);
    console.log('parent.cwd:', parent.cwd);
    console.log('team.runtimes[0].cwd:', team.runtimes[0].cwd);
    console.log('child services:', team.runtimes[0].services);
    expect(team.runtimes[0].cwd).toBe(parent.cwd);

    await team.dispose();
    await parent.dispose();
  });
});

describe("AgentTeam coordination", () => {
  it("should claim tasks correctly", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 1 });
    await team.initialize(["Task A", "Task B", "Task C"]);

    const task1 = await team.claimTask("agent-1");
    const task2 = await team.claimTask("agent-1");
    const task3 = await team.claimTask("agent-2");

    expect(task1).toBe(0);
    expect(task2).toBe(1);
    expect(task3).toBe(2);

    await team.dispose();
    await parent.dispose();
  });

  it("should not reassign claimed tasks", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 1 });
    await team.initialize(["Task A", "Task B"]);

    const task1 = await team.claimTask("agent-1");
    const task2 = await team.claimTask("agent-2");
    const task3 = await team.claimTask("agent-1"); // no more tasks

    expect(task1).toBe(0);
    expect(task2).toBe(1);
    expect(task3).toBeNull();

    await team.dispose();
    await parent.dispose();
  });

  it("should report results and complete", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 1 });
    await team.initialize(["Task A", "Task B"]);

    await team.reportResult(0, "Result A");
    await team.reportResult(1, "Result B");

    const results = await team.getResults();
    expect(results).toEqual(["Result A", "Result B"]);

    await team.dispose();
    await parent.dispose();
  });

  it("workspace should store and retrieve values", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 1 });
    await team.initialize([]); // Ensure team is initialized (maybe not needed but safe)

    team.getWorkspace().set("key1", "value1", "agent-1");
    team.getWorkspace().set("key2", { obj: "value" }, "agent-2");

    expect(team.getWorkspace().get("key1")).toBe("value1");
    expect(team.getWorkspace().get("key2")).toEqual({ obj: "value" });
    expect(team.getWorkspace().list()).toHaveLength(2);

    await team.dispose();
    await parent.dispose();
  });

  it("should wait for completion when all tasks reported", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 1 });
    await team.initialize(["Task A"]);

    // Simulate task being claimed and completed by an agent
    await team.claimTask("agent-1"); // Must claim first
    
    // Simulate async completion
    setTimeout(() => { void team.reportResult(0, "Done"); }, 100);

    await expect(team.waitForCompletion()).resolves.toBeUndefined();

    await team.dispose();
    await parent.dispose();
  });
});