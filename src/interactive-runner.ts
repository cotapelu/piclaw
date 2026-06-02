#!/usr/bin/env node

/**
 * Piclaw Interactive Runner
 *
 * Simply runs InteractiveMode with our customizations.
 * We avoid modifying keybindings to prevent conflicts.
 *
 * Default keybindings from package:
 * - Ctrl+P: Cycle models forward
 * - Ctrl+Shift+P: Cycle models backward
 * - Ctrl+L: Open model selector (default)
 * - No default key for session selector (use /resume command)
 */

import { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { InteractiveMode } from "@earendil-works/pi-coding-agent";
import type { InteractiveModeOptions } from "@earendil-works/pi-coding-agent";

/**
 * Run the interactive TUI mode with the given runtime.
 *
 * @param runtime - The agent session runtime (created by bootPiclaw)
 * @param options - Interactive mode options
 */
export async function runInteractive(
  runtime: AgentSessionRuntime,
  options: {
    verbose?: boolean;
    initialMessage?: string;
    initialImages?: any[]; // ImageContent[]
  } = {}
): Promise<void> {
  const interactiveOptions: InteractiveModeOptions = {
    verbose: options.verbose ?? false,
    initialMessage: options.initialMessage,
    initialImages: options.initialImages,
  };

  const interactive = new InteractiveMode(runtime, interactiveOptions);

  // No keybinding modifications - use package defaults
  // Ctrl+P / Ctrl+Shift+P: Cycle models
  // Ctrl+L: Open model selector
  // /resume command: Open session selector

  await interactive.run();
}
