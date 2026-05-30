/**
 * Auto-Compaction at 75% Context Usage
 *
 * Khi context usage vượt 75%, tự động chạy compaction.
 * Hook này chạy song song với auto-compaction mặc định.
 */

const COMPACTION_THRESHOLD_PERCENT = 75;

export default function (pi: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    const usage = ctx.getContextUsage();
    if (usage?.percent && usage.percent > COMPACTION_THRESHOLD_PERCENT) {
      ctx.compact();
    }
  });
}
