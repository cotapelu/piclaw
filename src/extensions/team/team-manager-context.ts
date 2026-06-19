/**
 * Team Manager Context Utilities
 *
 * Provides per-session TeamManager instances via WeakMap caching.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { TeamManager, InstanceTeamManager } from "./team-manager.js";

const managers = new WeakMap<ExtensionContext, TeamManager>();

/**
 * Get or create a TeamManager for the given session context.
 * Each context gets its own manager instance (wrapping legacy singleton for now).
 */
export function getTeamManager(ctx: ExtensionContext): TeamManager {
  // Allow explicit injection (e.g., tests)
  if ((ctx as any).teamManager) {
    return (ctx as any).teamManager;
  }
  let mgr = managers.get(ctx);
  if (!mgr) {
    mgr = new InstanceTeamManager();
    managers.set(ctx, mgr);
  }
  return mgr;
}
