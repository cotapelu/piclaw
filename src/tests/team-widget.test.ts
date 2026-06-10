import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock TeamRegistry
vi.mock('../extensions/team/team-manager.js', () => ({
  TeamRegistry: {
    getInstance: vi.fn(() => ({
      getAll: vi.fn(() => new Map()) // empty teams
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
    const onCalls = mockApi.on.mock.calls;
    const sessionStartCall = onCalls.find(c => c[0] === "session_start");
    expect(sessionStartCall).toBeDefined();
    sessionStartHandler = sessionStartCall[1];

    // Create mock context with minimal UI
    mockCtx = {
      ui: {
        setWidget: vi.fn(),
        theme: { fg: () => '' },
      },
    };

    // Simulate session start to initialize state
    await sessionStartHandler(null, mockCtx);
  });

  it("initial state enabled", () => {
    expect(getTeamWidgetEnabled(mockCtx)).toBe(true);
  });

  it("toggles invert state based on initial", () => {
    const initial = getTeamWidgetEnabled(mockCtx);
    const s1 = toggleTeamWidget(mockCtx);
    const s2 = toggleTeamWidget(mockCtx);
    const s3 = toggleTeamWidget(mockCtx);
    expect(s3).toBe(!initial);
    expect(getTeamWidgetEnabled(mockCtx)).toBe(!initial);
  });

  it("stopWidget clears UI widget", () => {
    // toggle off
    const after = toggleTeamWidget(mockCtx);
    expect(after).toBe(false);
    expect(mockCtx.ui.setWidget).toHaveBeenCalledWith("team", undefined);
  });
});

describe("Team Widget Registration", () => {
  it("registerTeamWidget is function", () => expect(typeof registerTeamWidget).toBe("function"));

  it("registers session_start listener", () => {
    const mockApi = { on: vi.fn(), registerCommand: vi.fn() };
    registerTeamWidget(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  it("registers session_shutdown listener per session", async () => {
    const mockApi = { on: vi.fn() };
    registerTeamWidget(mockApi);
    // Simulate session_start
    const sessionStartCall = mockApi.on.mock.calls.find(c => c[0] === "session_start");
    await sessionStartCall![1](null, { ui: { setWidget: vi.fn() } });
    // Should have registered session_shutdown
    const shutdownCalls = mockApi.on.mock.calls.filter(c => c[0] === "session_shutdown");
    expect(shutdownCalls.length).toBeGreaterThan(0);
  });
});
