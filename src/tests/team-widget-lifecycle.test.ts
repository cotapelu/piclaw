import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTeamWidget } from "../extensions/team/team-widget";
import { TeamRegistry } from "../extensions/team/team-manager";

// Mock TeamRegistry
vi.mock("../extensions/team/team-manager", () => ({
  TeamRegistry: {
    getInstance: vi.fn()
  }
}));

describe("Team Widget Lifecycle", () => {
  let mockSetWidget: any;
  let mockTeam: any;
  let mockRegistry: any;
  let ctx: any;

  beforeEach(() => {
    mockSetWidget = vi.fn();
    mockTeam = {
      getTeamStatus: vi.fn().mockResolvedValue({
        completedTasks: 0, totalTasks: 0, pendingTasks: 0, failedTasks: 0,
        agents: []
      })
    };
    mockRegistry = { getAll: vi.fn(() => new Map([["team1", mockTeam]])) };
    (TeamRegistry.getInstance as any).mockReturnValue(mockRegistry);
    ctx = {
      ui: {
        setWidget: mockSetWidget,
        theme: { fg: (c: string, t?: string) => (t ?? c), bold: (t: string) => t }
      },
      cwd: "/repo"
    };
  });

  it("triggers refresh on session_start", async () => {
    const mockApi = { on: vi.fn(), registerTool: vi.fn() };
    registerTeamWidget(mockApi);
    const handler = mockApi.on.mock.calls.find(c => c[0] === "session_start")?.[1];
    expect(handler).toBeDefined();
    await handler(null, ctx);
    expect(mockSetWidget).toHaveBeenCalled();
  });

  it("registers session_shutdown listener", async () => {
    const mockApi = { on: vi.fn(), registerTool: vi.fn() };
    registerTeamWidget(mockApi);
    const handler = mockApi.on.mock.calls.find(c => c[0] === "session_start")?.[1];
    await handler(null, ctx);
    const shutdownCalls = mockApi.on.mock.calls.filter(c => c[0] === "session_shutdown");
    expect(shutdownCalls.length).toBeGreaterThan(0);
  });
});
