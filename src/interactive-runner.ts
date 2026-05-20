#!/usr/bin/env node

/**
 * Piclaw Interactive Runner
 *
 * Handles starting the interactive TUI mode.
 * Separated from core bootstrapping for cleaner architecture.
 */

import { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { InteractiveMode } from "@earendil-works/pi-coding-agent";
import type { InteractiveModeOptions } from "@earendil-works/pi-coding-agent";

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
