#!/usr/bin/env node

import { describe, it, expect, vi } from "vitest";

// Mock TeamRegistry for any potential use
vi.mock('../extensions/team/team-manager.js', () => ({
  TeamRegistry: {
    getInstance: vi.fn(() => ({
      getAll: vi.fn()
    }))
  }
}));

import { toggleTeamWidget, getTeamWidgetEnabled, registerTeamWidget } from "../extensions/team/team-widget.js";

describe("Team Widget Toggle", () => {
  it("initial state enabled", () => expect(getTeamWidgetEnabled()).toBe(true));

  it("toggles invert state based on initial", () => {
    const initial = getTeamWidgetEnabled();
    const s1 = toggleTeamWidget();
    const s2 = toggleTeamWidget();
    const s3 = toggleTeamWidget();
    expect(s3).toBe(!initial);
    expect(getTeamWidgetEnabled()).toBe(!initial);
  });
});

describe("Team Widget Registration", () => {
  it("registerTeamWidget is function", () => expect(typeof registerTeamWidget).toBe("function"));

  it("registers session_start listener", () => {
    const mockApi = { on: vi.fn(), registerTool: vi.fn() };
    registerTeamWidget(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });
});
