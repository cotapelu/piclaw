/**
 * Auto-Compaction at 75% Context Usage
 *
 * This extension triggers compaction automatically when context usage exceeds 75%.
 * It works alongside the built-in auto-compaction (which uses configured threshold).
 *
 * Usage:
 *   pi -e ./extensions/auto-compaction-75.ts
 */

export default function (pi: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
	pi.on("agent_end", async (event, ctx) => {
		// Only run if UI is available (optional, remove if you want it to work in print/RPC mode too)
		if (!ctx.hasUI) return;

		try {
			const usage = ctx.session.getContextUsage();
			if (!usage.percent) return; // Unknown percentage, skip

			// Check if context usage exceeds 75%
			if (usage.percent > 75) {
				// Only compact if no compaction is already running
				if (!ctx.session.isCompacting) {
					// Optional: Add a cooldown to avoid rapid successive compactions
					// You could store last compaction timestamp in ctx.sessionManager appendEntry
					await ctx.session.compact({
						customInstructions: "Auto-compaction triggered at >75% context usage",
					});
				}
			}
		} catch (error) {
			// Silently ignore errors to avoid disrupting the session
			// Optionally log to extension error handler
			pi.emitError({
				extensionPath: "<auto-compaction-75>",
				event: "agent_end",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});
}
