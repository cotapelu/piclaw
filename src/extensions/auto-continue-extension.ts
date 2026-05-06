#!/usr/bin/env node
/**
 * Auto Continue Extension
 *
 * Khi agent idle (sau khi trả lời xong) quá lâu, tự động gửi message để nhắc LLM tiếp tục.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const IDLE_TIMEOUT_MS = 300_000; // 300 giây (5 phút)
const IDLE_MESSAGE = "Continue next task in docs/TODO.md, remember update done and git commit.";

export default function (pi: ExtensionAPI) {
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let currentCtx: ExtensionContext | null = null;

  function resetTimer(ctx: ExtensionContext): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    currentCtx = ctx;
  }

  function startIdleTimer(ctx: ExtensionContext): void {
    resetTimer(ctx);
    idleTimer = setTimeout(async () => {
      if (pi && typeof pi.sendMessage === "function") {
        try {
          await (pi.sendMessage as any)(
            { content: IDLE_MESSAGE },
            { triggerTurn: true, deliverAs: "followUp" }
          );
          console.log("[AutoContinue] Sent idle reminder message.");
        } catch (e) {
          console.error("[AutoContinue] Failed to send message:", e);
        }
      }
      idleTimer = null;
    }, IDLE_TIMEOUT_MS);
  }

  pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
    resetTimer(ctx);
  });

  pi.on("input", (_event: any, ctx: ExtensionContext) => {
    resetTimer(ctx);
  });

  pi.on("message_start", (_event: any, ctx: ExtensionContext) => {
    resetTimer(ctx);
  });

  pi.on("message_end", (_event: any, ctx: ExtensionContext) => {
    startIdleTimer(ctx);
  });

  pi.on("tool_execution_start", (_event: any, ctx: ExtensionContext) => {
    resetTimer(ctx);
  });

  pi.on("tool_execution_end", (_event: any, ctx: ExtensionContext) => {
    startIdleTimer(ctx);
  });

  pi.on("session_shutdown", () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    currentCtx = null;
  });
}
