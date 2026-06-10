#!/usr/bin/env node

/**
 * Metrics Widget Toggle Command
 *
 * Toggle the metrics dashboard widget.
 * Usage: /metrics (toggle on/off)
 */

import { toggleMetricsWidget, getMetricsWidgetEnabled } from "../metrics/metrics-widget.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerMetricsCommand(api: ExtensionAPI): void {
  api.registerCommand("metrics", {
    description: "Toggle metrics dashboard widget",
    handler: async (_args: string, ctx: any) => {
      const before = getMetricsWidgetEnabled(ctx);
      const after = toggleMetricsWidget(ctx);
      const status = after ? "shown" : "hidden";
      ctx.ui.notify(`Metrics widget ${status}`, "info");
    },
  });
}
