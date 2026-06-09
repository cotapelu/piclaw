#!/usr/bin/env node
/**
 * Runtime Runner - Global Runtime Management
 *
 * Provides simple global runtime storage for tests and multi-session scenarios.
 * Not heavily used in production; primarily for testability.
 */

import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';

let globalRuntime: AgentSessionRuntime | null = null;

/**
 * Set the global runtime instance.
 * Used by test harness and potential multi-session coordination.
 */
export function setGlobalRuntime(runtime: AgentSessionRuntime): void {
  globalRuntime = runtime;
}

/**
 * Get the current global runtime instance.
 * Returns undefined if not set.
 */
export function getGlobalRuntime(): AgentSessionRuntime | undefined {
  return globalRuntime ?? undefined;
}

/**
 * Clear the global runtime instance.
 * Typically called between tests or during shutdown.
 */
export function clearGlobalRuntime(): void {
  globalRuntime = null;
}
