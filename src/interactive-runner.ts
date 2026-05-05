#!/usr/bin/env node

/**
 * Piclaw Interactive Runner
 *
 * Handles starting the interactive TUI mode.
 * Separated from core bootstrapping for cleaner architecture.
 */

// Apply persistent command history patches
import "./command-history-patch.js";

import { AgentSessionRuntime } from "@mariozechner/pi-coding-agent";
import { InteractiveMode } from "@mariozechner/pi-coding-agent";
import type { InteractiveModeOptions } from "@mariozechner/pi-coding-agent";

/**
 * Run the interactive TUI mode with the given runtime.
 *
 * @param runtime - The agent session runtime (created by bootPiclaw)
 * @param options - Interactive mode options (verbose, etc.)
 */
export async function runInteractive(
  runtime: AgentSessionRuntime,
  options: { verbose?: boolean } = {}
): Promise<void> {
  const interactiveOptions: InteractiveModeOptions = {
    verbose: options.verbose ?? false,
  };

  const interactive = new InteractiveMode(runtime, interactiveOptions);
  await interactive.run();
}
