/**
 * Team Manager Context Utilities
 *
 * Provides per-session TeamManager instances via WeakMap caching.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { TeamManager, getDefaultTeamManager } from "./team-manager.js";

const managers = new WeakMap<ExtensionContext, TeamManager>();

/**
 * Get or create a TeamManager for the given session context.
 * Each context gets its own manager instance (wrapping legacy singleton for now).
 */
export function getTeamManager(ctx: ExtensionContext): TeamManager {
  let mgr = managers.get(ctx);
  if (!mgr) {
    mgr = getDefaultTeamManager();
    managers.set(ctx, mgr);
  }
  return mgr;
}
