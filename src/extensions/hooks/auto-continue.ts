#!/usr/bin/env node
/**
 * Auto Continue Extension
 *
 * Khi agent idle (sau khi trả lời xong) quá lâu, tự động gửi message để nhắc LLM tiếp tục.
 * Dùng /gnp để bật/tắt.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const IDLE_TIMEOUT_MS = 60_000; // 60 giây (1 phút)
const IDLE_MESSAGE = "Continue next task in docs/TODO.md, remember update done and git commit.";

export default function (pi: ExtensionAPI) {
  let enabled = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  // Register /gnp command
  pi.registerCommand("gnp", {
    description: "Toggle auto-continue: bật/tắt tự động gửi message khi idle",
    handler: async (_args: string, ctx: ExtensionContext) => {
      enabled = !enabled;

      if (enabled) {
        // Enable: show notification via ctx
        if (ctx.hasUI) {
          ctx.ui.notify("Auto-continue đã BẬT - sẽ gửi reminder sau 1 phút idle", "info");
        }
        console.log("[AutoContinue] Enabled");
      } else {
        // Disable: clear timer and show notification
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (ctx.hasUI) {
          ctx.ui.notify("Auto-continue đã TẮT", "info");
        }
        console.log("[AutoContinue] Disabled");
      }
    },
  });

  // Listen to agent_end using pi.on()
  pi.on("agent_end", () => {
    console.log("[AutoContinue] agent_end fired, enabled:", enabled);
    if (!enabled || idleTimer) return;

    idleTimer = setTimeout(() => {
      console.log("[AutoContinue] Timer fired, enabled:", enabled);
      if (enabled) {
        (pi.sendMessage as any)(
          { content: IDLE_MESSAGE },
          { triggerTurn: true, deliverAs: "followUp" }
        );
        console.log("[AutoContinue] Sent idle reminder message.");
      }
      idleTimer = null;
    }, IDLE_TIMEOUT_MS);
  });
}
