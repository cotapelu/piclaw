/**
 * Tests for AgentSession Team functionality
 */
import { describe, it, expect } from "vitest";
import { bootPiclawTeam, executeTeamTasks } from "../team/team-manager.js";
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
  });

  it("should share session manager", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 2 });

    expect(team.runtimes[0].session.sessionManager)
      .toBe(team.runtimes[1].session.sessionManager);

    await team.dispose();
  });

  it("should use same codebase", async () => {
    const parent = await bootPiclaw();
    const team = await bootPiclawTeam(parent, { teamSize: 2 });

    expect(team.runtimes[0].cwd).toBe(parent.cwd);

    await team.dispose();
  });
});

describe("executeTeamTasks", () => {
  it("should be callable", async () => {
    expect(executeTeamTasks).toBeDefined();
  });
});