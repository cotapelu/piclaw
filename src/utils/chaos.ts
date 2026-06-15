#!/usr/bin/env node

/**
 * Chaos Engineering Utility
 *
 * Allows injection of random failures for testing resilience.
 * Enable by setting environment variable PICLAW_CHAOS_RATE to a probability (0.0 - 1.0).
 *
 * Example: PICLAW_CHAOS_RATE=0.1 npm test will randomly fail ~10% of operations.
 */

export function chaos(operation: string): void {
  const rate = process.env.PICLAW_CHAOS_RATE ? parseFloat(process.env.PICLAW_CHAOS_RATE) : 0;
  if (rate > 0 && Math.random() < rate) {
    throw new Error(`[CHAOS] Simulated failure in ${operation}`);
  }
}
