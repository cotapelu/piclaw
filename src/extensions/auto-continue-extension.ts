#!/usr/bin/env node
/**
 * Auto Continue Extension
 *
 * Khi agent idle (sau khi trả lời xong) quá lâu, tự động gửi message "Continue next task"
 * để nhắc LLM tiếp tục công việc.
 *
 * Cách hoạt động:
 * - Khi assistant kết thúc message (message_end), bắt đầu đếm thời gian idle.
 * - Nếu sau 60s không có activity (user input, tool execution, message mới), tự động gửi message.
 * - Gửi xong, reset timer.
 *
 * Dựa trên pattern từ todos-tool.ts: dùng ctx.agent.sendMessage().
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const IDLE_TIMEOUT_MS = 60_000; // 60 giây (1 phút)

export default function (pi: ExtensionAPI) {
  let idleTimer: NodeJS.Timeout | null = null;
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
      // Gửi message "Continue next task" vào conversation
      if (pi && typeof pi.sendMessage === "function") {
        try {
          await (pi.sendMessage as any)(
            { content: "Continue next task." },
            { triggerTurn: true, deliverAs: "followUp" }
          );
          console.log("[AutoContinue] Sent 'Continue next task' message.");
        } catch (e) {
          console.error("[AutoContinue] Failed to send message:", e);
        }
      }
      // Reset timer để không gửi liên tục
      idleTimer = null;
    }, IDLE_TIMEOUT_MS);
  }

  // Khi session bắt đầu
  pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
    resetTimer(ctx);
  });

  // Khi user nhập input -> reset (có activity)
  pi.on("input", (_event: any, ctx: ExtensionContext) => {
    resetTimer(ctx);
  });

  // Khi assistant bắt đầu trả lời -> reset (đang active)
  pi.on("message_start", (_event: any, ctx: ExtensionContext) => {
    resetTimer(ctx);
  });

  // Khi assistant kết thúc trả lời -> bắt đầu đếm idle
  pi.on("message_end", (_event: any, ctx: ExtensionContext) => {
    startIdleTimer(ctx);
  });

  // Tool execution cũng là activity
  pi.on("tool_execution_start", (_event: any, ctx: ExtensionContext) => {
    resetTimer(ctx);
  });

  pi.on("tool_execution_end", (_event: any, ctx: ExtensionContext) => {
    // Sau khi tool xong, vẫn có thể idle, nên bắt đầu timer
    startIdleTimer(ctx);
  });

  // Cleanup khi shutdown
  pi.on("session_shutdown", () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    currentCtx = null;
  });
}
