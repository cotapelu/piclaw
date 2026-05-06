/**
 * Tests for AgentSession Team functionality
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bootPiclawTeam, executeTeamTasks } from "../piclaw-core.js";
import { AgentSessionRuntime } from "@mariozechner/pi-coding-agent";

describe("AgentSession Team", () => {
  it("should create a team with specified size", async () => {
    const team = await bootPiclawTeam({
      teamSize: 3,
      tools: ["read", "bash", "edit", "write"],
    });

    expect(team.size).toBe(3);
    expect(team.runtimes).toHaveLength(3);
    expect(team.roles).toEqual([]);

    // Each runtime should have independent sessions
    // sessionId is accessed via session.sessionId
    expect(team.runtimes[0].session.sessionId).not.toBe(team.runtimes[1].session.sessionId);
    expect(team.runtimes[1].session.sessionId).not.toBe(team.runtimes[2].session.sessionId);

    await team.dispose();
  });

  it("should create a team with predefined roles", async () => {
    const team = await bootPiclawTeam({
      teamSize: 2,
      teamRoles: ["architect", "coder"],
    });

    expect(team.size).toBe(2);
    expect(team.roles).toEqual(["architect", "coder"]);

    await team.dispose();
  });

  it("should have independent message states per agent", async () => {
    const team = await bootPiclawTeam({
      teamSize: 2,
    });

    // Initial state: all agents have 0 messages
    expect(team.runtimes[0].session.messages).toHaveLength(0);
    expect(team.runtimes[1].session.messages).toHaveLength(0);

    await team.dispose();
  });

  it("should dispose all agents cleanly", async () => {
    const team = await bootPiclawTeam({
      teamSize: 2,
    });

    // Dispose should not throw
    await expect(team.dispose()).resolves.not.toThrow();
  });

  it("should use shared services (AuthStorage, ModelRegistry, SettingsManager)", async () => {
    const team = await bootPiclawTeam({
      teamSize: 2,
    });

    // All runtimes should share the same shared services instances
    expect(team.runtimes[0].services.authStorage).toBe(team.runtimes[1].services.authStorage);
    expect(team.runtimes[0].services.modelRegistry).toBe(team.runtimes[1].services.modelRegistry);
    expect(team.runtimes[0].services.settingsManager).toBe(team.runtimes[1].services.settingsManager);

    // But ResourceLoader should be different per agent
    expect(team.runtimes[0].services.resourceLoader).not.toBe(team.runtimes[1].services.resourceLoader);

    await team.dispose();
  });

  it("should default to single agent when teamSize is 1", async () => {
    const team = await bootPiclawTeam({
      teamSize: 1,
    });

    expect(team.size).toBe(1);
    expect(team.runtimes).toHaveLength(1);

    await team.dispose();
  });
});

describe("executeTeamTasks", () => {
  it("should distribute tasks in parallel mode", async () => {
    const team = await bootPiclawTeam({
      teamSize: 3,
      tools: ["read", "bash", "edit", "write"],
    });

    // Mock the prompt to avoid actual LLM calls
    const mockResults = ["result1", "result2", "result3"];
    let callCount = 0;
    
    for (const runtime of team.runtimes) {
      (runtime.session as any).prompt = async () => {
        runtime.session.messages.push({
          role: "assistant",
          content: mockResults[callCount++],
          timestamp: Date.now(),
        });
      };
    }

    const results = await executeTeamTasks(team, ["task1", "task2", "task3"], "parallel");

    expect(results).toHaveLength(3);

    await team.dispose();
  });

  it("should run tasks sequentially", async () => {
    const team = await bootPiclawTeam({
      teamSize: 2,
    });

    let callCount = 0;
    for (const runtime of team.runtimes) {
      (runtime.session as any).prompt = async () => {
        runtime.session.messages.push({
          role: "assistant",
          content: `result${callCount++}`,
          timestamp: Date.now(),
        });
      };
    }

    const results = await executeTeamTasks(team, ["task1", "task2"], "sequential");

    expect(results).toHaveLength(2);

    await team.dispose();
  });
});