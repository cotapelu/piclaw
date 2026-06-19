import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTeamWidget } from "../extensions/team/team-widget";
import { TeamRegistry } from "../extensions/team/team-manager";

const mockManager = {
  getAll: vi.fn(),
  get: vi.fn(),
  has: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  resetAutoDisposeTimer: vi.fn(),
  waitForTeam: vi.fn().mockResolvedValue(true)
};

vi.mock("../extensions/team/team-manager", () => ({
  TeamRegistry: {
    getInstance: vi.fn()
  },
  getDefaultTeamManager: vi.fn(() => mockManager)
}));

describe("Team Widget Lifecycle", () => {
  let mockSetWidget: any;
  let mockTeam: any;
  let mockRegistry: any;
  let ctx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetWidget = vi.fn();
    mockTeam = {
      getTeamStatus: vi.fn().mockResolvedValue({
        completedTasks: 0, totalTasks: 0, pendingTasks: 0, failedTasks: 0,
        agents: []
      })
    };
    mockManager.getAll.mockReturnValue(new Map([["team1", mockTeam]]));
    ctx = {
      ui: {
        setWidget: mockSetWidget,
        theme: { fg: (c: string, t?: string) => (t ?? c), bold: (t: string) => t }
      },
      cwd: "/repo",
      teamManager: mockManager
    };
  });

  it("triggers refresh on session_start and renders team status", async () => {
    const mockApi = { on: vi.fn(), registerTool: vi.fn() };
    registerTeamWidget(mockApi);
    const handler = mockApi.on.mock.calls.find(c => c[0] === "session_start")?.[1];
    expect(handler).toBeDefined();
    await handler(null, ctx);
    // refreshWidget should have called setWidget at least twice: initial and after team status? Actually startWidget triggers refresh, which calls setWidget multiple times possibly. At least one call.
    expect(mockSetWidget).toHaveBeenCalled();
    // Inspect last call's argument (lines array)
    const lastCall = mockSetWidget.mock.calls[mockSetWidget.mock.calls.length - 1];
    const lines: string[] = lastCall[1]; // setWidget("team", lines)
    expect(lines.some(l => l.includes("Team"))).toBe(true);
    // Since status has 0/0 tasks
    expect(lines.some(l => l.includes("0/0"))).toBe(true);
    // Should show Agents: 0 (idle: 0, working: 0)
    expect(lines.some(l => l.includes("Agents:"))).toBe(true);
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
