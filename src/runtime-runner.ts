#!/usr/bin/env node

/**
 * Runtime Runner - Global Runtime Management
 *
 * Provides utilities for accessing the global runtime instance.
 * Used by extensions that need runtime access outside of normal context flow.
 */

import { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";

let globalRuntime: AgentSessionRuntime | null = null;

/**
 * Set the global runtime instance.
 * Called by main.ts after booting.
 */
export function setGlobalRuntime(runtime: AgentSessionRuntime): void {
  globalRuntime = runtime;
}

/**
 * Get the global runtime instance.
 * Returns undefined if not yet set.
 */
export function getGlobalRuntime(): AgentSessionRuntime | undefined {
  return globalRuntime ?? undefined;
}

/**
 * Clear the global runtime (useful for testing).
 */
export function clearGlobalRuntime(): void {
  globalRuntime = null;
}
