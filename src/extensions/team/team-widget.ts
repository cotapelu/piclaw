#!/usr/bin/env node
/**
 * Team Status Widget
 *
 * Shows team overview in the UI widget area.
 * Displays: team ID, size, tasks, agent statuses.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerTeamWidget(api: ExtensionAPI): void {
  // Set widget on session start
  api.on("session_start", async (_event, ctx) => {
    const allTools = api.getAllTools();
    const hasTeamTool = allTools.some(t => t.name === "team_ops" || t.name === "team_tool");

    if (!hasTeamTool) {
      ctx.ui.setWidget("team", undefined);
      return;
    }

    // Render widget as string array
    const widgetContent = renderTeamWidget(ctx.ui.theme);
    ctx.ui.setWidget("team", widgetContent);
  });
}

function renderTeamWidget(theme: any): string[] {
  const lines: string[] = [];

  lines.push(theme.fg("accent", "👥 Team").bold());
  lines.push(""); // spacer
  lines.push(theme.fg("muted", "Multi-agent协作系统已加载"));
  lines.push(theme.fg("muted", "使用 team_ops 进行任务分配"));
  lines.push(theme.fg("muted", "使用 /team 命令管理团队"));

  return lines;
}
