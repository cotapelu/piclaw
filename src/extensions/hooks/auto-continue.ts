#!/usr/bin/env node
/**
 * Auto Continue Extension
 *
 * Khi agent idle (sau khi trả lời xong) quá lâu, tự động gửi message để nhắc LLM tiếp tục.
 * Dùng /gnp để bật/tắt.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const IDLE_TIMEOUT_MS = 60_000; // 60 giây (1 phút)
const IDLE_MESSAGE = "Continue next task in docs/TODO.md, remember update done and git commit.";

export default function (pi: ExtensionAPI) {
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let enabled = false; // Default: disabled

  // Register /gnp command to toggle enable/disable
  pi.registerCommand("gnp", {
    description: "Toggle auto-continue: bật/tắt tự động gửi message khi idle",
    handler: async (_args, ctx) => {
      enabled = !enabled;
      if (enabled) {
        console.log("[AutoContinue] Enabled - sẽ gửi reminder sau 1 phút idle");
      } else {
        console.log("[AutoContinue] Disabled");
        // Clear timer when disabled
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      }
    },
  });

  // Only listen to message_end to start the idle timer
  pi.on("message_end", async () => {
    if (!enabled || idleTimer) return;

    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (enabled) {
        (pi.sendMessage as any)(
          { content: IDLE_MESSAGE },
          { triggerTurn: true, deliverAs: "followUp" }
        );
        console.log("[AutoContinue] Sent idle reminder message.");
      }
    }, IDLE_TIMEOUT_MS);
  });

  // Reset timer on user input
  pi.on("input", () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  });
}
