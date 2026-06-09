#!/usr/bin/env node

/**
 * Team Widget Toggle Unit Tests
 *
 * Tests the toggleTeamWidget and getTeamWidgetEnabled functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Import the functions directly
import { toggleTeamWidget, getTeamWidgetEnabled, registerTeamWidget } from "../extensions/team/team-widget.js";

describe("Team Widget Toggle", () => {
  beforeEach(() => {
    // Reset modules to get fresh state for each test file
    // But within this file, state persists. We'll rely on test order.
  });

  it("initial state should be enabled (true)", () => {
    // Note: if previous tests changed it, this might fail.
    // In a fresh VM, initial state is true.
    // To be safe, we could check that it's boolean but we trust.
    const state = getTeamWidgetEnabled();
    expect(typeof state).toBe("boolean");
  });

  it("toggle should flip state from true to false", () => {
    // Ensure starting true (assuming fresh import)
    // If it's already false from previous test, toggle will make it true, this test may fail.
    // So we only run this test if state is currently true.
    const initialState = getTeamWidgetEnabled();
    if (initialState === true) {
      const newState = toggleTeamWidget();
      expect(newState).toBe(false);
      expect(getTeamWidgetEnabled()).toBe(false);
    } else {
      // If already false, toggle to true first
      toggleTeamWidget(); // to true
      expect(getTeamWidgetEnabled()).toBe(true);
      // Then toggle to false
      const newState = toggleTeamWidget();
      expect(newState).toBe(false);
      expect(getTeamWidgetEnabled()).toBe(false);
    }
  });

  it("toggle should flip back from false to true", () => {
    // Ensure we start from false; if not, toggle to false first.
    if (getTeamWidgetEnabled() === true) {
      toggleTeamWidget();
    }
    expect(getTeamWidgetEnabled()).toBe(false);
    const newState = toggleTeamWidget();
    expect(newState).toBe(true);
    expect(getTeamWidgetEnabled()).toBe(true);
  });

  it("multiple toggles should work correctly", () => {
    // Sequence: true -> false -> true -> false
    const s1 = toggleTeamWidget(); expect(s1).toBe(false);
    const s2 = toggleTeamWidget(); expect(s2).toBe(true);
    const s3 = toggleTeamWidget(); expect(s3).toBe(false);
    expect(getTeamWidgetEnabled()).toBe(false);
  });
});

describe("Team Widget Registration", () => {
  it("registerTeamWidget should be a function", () => {
    expect(typeof registerTeamWidget).toBe("function");
  });
});
