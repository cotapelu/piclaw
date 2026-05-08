#!/usr/bin/env node
/**
 * Auto Continue Extension
 *
 * Khi agent idle (sau khi trả lời xong) quá lâu, tự động gửi message để nhắc LLM tiếp tục.
 * Dùng /gnp để bật/tắt, và có thể set timeout: /gnp on 30 (30 giây) hoặc /gnp off.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const DEFAULT_IDLE_TIMEOUT_MS = 30_000; // 30 giây
const IDLE_MESSAGE = "Continue next task in docs/TODO.md, remember update done and git commit.";

export default function (pi: ExtensionAPI) {
  let enabled = false;
  let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  // Cleanup timer on shutdown
  pi.on("session_shutdown", () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  });

  // Start idle timer
  const startIdleTimer = () => {
    if (idleTimer) return;
    idleTimer = setTimeout(() => {
      console.log("[AutoContinue] Timer fired, enabled:", enabled);
      if (enabled) {
        pi.sendMessage(
          { customType: "auto-continue", content: IDLE_MESSAGE, display: false },
          { triggerTurn: true, deliverAs: "followUp" }
        );
        console.log("[AutoContinue] Sent idle reminder message.");
      }
      idleTimer = null;
    }, idleTimeoutMs);
  };

  // Register /gnp command
  pi.registerCommand("gnp", {
    description: "Toggle auto-continue: /gnp [on|off|seconds]. Bật/tắt hoặc set timeout (seconds)",
    handler: async (args: string, ctx: ExtensionContext) => {
      const parts = args.trim().split(/\s+/);
      const command = parts[0].toLowerCase();

      if (command === "off" || command === "0") {
        enabled = false;
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (ctx.hasUI) {
          ctx.ui.notify("Auto-continue đã TẮT", "info");
        }
        console.log("[AutoContinue] Disabled");
        return;
      }

      if (command === "on" || command === "1") {
        enabled = true;
        if (ctx.hasUI) {
          ctx.ui.notify(`Auto-continue đã BẬT - sẽ gửi reminder sau ${idleTimeoutMs / 1000} giây idle`, "info");
        }
        if (ctx.isIdle()) {
          startIdleTimer();
          console.log("[AutoContinue] Started timer immediately (was idle)");
        }
        console.log("[AutoContinue] Enabled");
        return;
      }

      // If args is a number, set timeout
      const timeoutSec = parseInt(parts[0], 10);
      if (!isNaN(timeoutSec) && timeoutSec > 0) {
        idleTimeoutMs = timeoutSec * 1000;
        if (ctx.hasUI) {
          ctx.ui.notify(`Auto-continue timeout set to ${timeoutSec} giây`, "info");
        }
        console.log(`[AutoContinue] Timeout set to ${idleTimeoutMs}ms`);
        return;
      }

      // If no args, toggle
      enabled = !enabled;
      if (enabled) {
        if (ctx.hasUI) {
          ctx.ui.notify(`Auto-continue đã BẬT - timeout=${idleTimeoutMs / 1000}s`, "info");
        }
        if (ctx.isIdle()) {
          startIdleTimer();
        }
        console.log("[AutoContinue] Enabled via toggle");
      } else {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (ctx.hasUI) {
          ctx.ui.notify("Auto-continue đã TẮT", "info");
        }
        console.log("[AutoContinue] Disabled via toggle");
      }
    },
  });

  // Listen to agent_end using pi.on()
  pi.on("agent_end", () => {
    console.log("[AutoContinue] agent_end fired, enabled:", enabled);
    if (!enabled) return;
    startIdleTimer();
  });
}
