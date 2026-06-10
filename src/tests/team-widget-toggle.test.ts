import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock TeamRegistry
vi.mock('../extensions/team/team-manager.js', () => ({
  TeamRegistry: {
    getInstance: vi.fn(() => ({
      getAll: vi.fn(() => new Map())
    }))
  }
}));

import { toggleTeamWidget, getTeamWidgetEnabled, registerTeamWidget } from "../extensions/team/team-widget.js";

describe("Team Widget Toggle (per-session)", () => {
  let mockApi: any;
  let sessionStartHandler: Function;
  let mockCtx: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApi = { on: vi.fn(), registerCommand: vi.fn() };
    registerTeamWidget(mockApi);

    // Extract session_start handler
    const sessionStartCall = mockApi.on.mock.calls.find(c => c[0] === "session_start");
    expect(sessionStartCall).toBeDefined();
    sessionStartHandler = sessionStartCall[1];

    // Create mock context
    mockCtx = {
      ui: {
        setWidget: vi.fn(),
        theme: { fg: () => '' },
      },
    };

    // Simulate session start
    await sessionStartHandler(null, mockCtx);
  });

  it("initial state enabled", () => {
    expect(getTeamWidgetEnabled(mockCtx)).toBe(true);
  });

  it("toggleTeamWidget flips state", () => {
    const first = toggleTeamWidget(mockCtx);
    expect(first).toBe(false);
    expect(getTeamWidgetEnabled(mockCtx)).toBe(false);

    const second = toggleTeamWidget(mockCtx);
    expect(second).toBe(true);
    expect(getTeamWidgetEnabled(mockCtx)).toBe(true);
  });
});
