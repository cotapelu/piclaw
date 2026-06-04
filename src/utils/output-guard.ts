#!/usr/bin/env node

/**
 * Output Guard
 *
 * Simple utility to takeover stdout for non-interactive modes (print, json, rpc).
 * Prevents TUI from messing with terminal control sequences.
 *
 * IMPORTANT: This is Piclaw's own simple implementation.
 */

let originalWrite: typeof process.stdout.write | null = null;
let buffer: string[] = [];

/**
 * Take over stdout - all writes go to buffer instead.
 * Call before starting non-interactive mode.
 */
export function takeOverStdout(): void {
  if (!originalWrite) {
    originalWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as typeof process.stdout).write = (chunk: unknown, encoding?: string | undefined, callback?: ((error: Error | null) => void) | undefined) => {
      buffer.push(chunk.toString());
      return true;
    };
  }
}

/**
 * Restore stdout - flush buffer then restore original write.
 * Call after non-interactive mode completes.
 */
export function restoreStdout(): void {
  if (originalWrite) {
    // Flush buffer
    for (const chunk of buffer) {
      originalWrite(chunk);
    }
    buffer = [];
    // Restore
    (process.stdout as any).write = originalWrite;
    originalWrite = null;
  }
}

/**
 * Clear buffer without restoring (for error recovery)
 */
export function clearBuffer(): void {
  buffer = [];
}
