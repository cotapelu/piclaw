import { describe, it, expect } from "vitest";
import { toggleTeamWidget, getTeamWidgetEnabled } from "../extensions/team/team-widget";

describe("Team Widget Toggle", () => {
  it("getTeamWidgetEnabled returns initial true", () => {
    expect(getTeamWidgetEnabled()).toBe(true);
  });

  it("toggleTeamWidget flips state", () => {
    const first = toggleTeamWidget();
    expect(first).toBe(false);
    expect(getTeamWidgetEnabled()).toBe(false);

    const second = toggleTeamWidget();
    expect(second).toBe(true);
    expect(getTeamWidgetEnabled()).toBe(true);
  });
});
