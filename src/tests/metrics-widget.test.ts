import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMetricsWidget, toggleMetricsWidget, getMetricsWidgetEnabled } from "../extensions/metrics/metrics-widget.js";

describe("Metrics Widget (per-session)", () => {
  let mockApi: any;
  let sessionStartHandler: Function;
  let mockCtx: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApi = { on: vi.fn() };
    registerMetricsWidget(mockApi);

    const sessionStartCall = mockApi.on.mock.calls.find(c => c[0] === "session_start");
    expect(sessionStartCall).toBeDefined();
    sessionStartHandler = sessionStartCall[1];

    mockCtx = {
      ui: {
        setWidget: vi.fn(),
        theme: { fg: () => '' },
      },
      getContextUsage: () => ({ tokens: 123, contextWindow: 2000, percent: 6.15 }),
      model: { id: 'test-model' },
      isIdle: () => true,
      signal: null,
    };
    await sessionStartHandler(null, mockCtx);
  });

  it("initial state enabled", () => {
    expect(getMetricsWidgetEnabled(mockCtx)).toBe(true);
  });

  it("toggles invert state", () => {
    const initial = getMetricsWidgetEnabled(mockCtx);
    const after1 = toggleMetricsWidget(mockCtx);
    const after2 = toggleMetricsWidget(mockCtx);
    expect(after1).toBe(false);
    expect(after2).toBe(true);
    expect(getMetricsWidgetEnabled(mockCtx)).toBe(initial);
  });

  it("stopWidget clears widget UI", () => {
    // toggle off triggers stopWidget via function? Actually toggleMetricsWidget calls stopWidget internally.
    toggleMetricsWidget(mockCtx); // turn off
    expect(mockCtx.ui.setWidget).toHaveBeenCalledWith("metrics", undefined);
  });
});

describe("Metrics Widget Registration", () => {
  it("registers session_start and session_shutdown", () => {
    const mockApi = { on: vi.fn() };
    registerMetricsWidget(mockApi);
    const startCalls = mockApi.on.mock.calls.filter(c => c[0] === "session_start");
    expect(startCalls.length).toBeGreaterThan(0);
    const handler = startCalls[0][1];
    const ctx = {
      ui: { setWidget: vi.fn(), theme: { fg: () => '' } },
      getContextUsage: () => undefined,
      isIdle: () => true,
      signal: null,
    } as any;
    handler(null, ctx);
    const shutdownCalls = mockApi.on.mock.calls.filter(c => c[0] === "session_shutdown");
    expect(shutdownCalls.length).toBeGreaterThan(0);
  });
});
