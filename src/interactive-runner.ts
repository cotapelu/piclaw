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
import { logger } from "./utils/logger.js";

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

  // Custom keybindings: Override session selector to Ctrl+R (if not already set)
  // Only override if user hasn't customized it in their keybindings.json
  try {
    const anyInteractive = interactive as any;
    const kb: any = anyInteractive.keybindings;
    if (kb && typeof kb.setUserBindings === 'function') {
      const currentBindings: any = kb.getUserBindings();
      // Only set if not already customized
      if (!currentBindings['app.session.resume']) {
        kb.setUserBindings({ 'app.session.resume': 'ctrl+r' });
        logger.debug('Bound session selector to Ctrl+R');
      } else {
        const userBinding = currentBindings['app.session.resume'];
        const bindingStr = Array.isArray(userBinding) ? userBinding.join(', ') : String(userBinding);
        logger.debug(`Session selector using user binding: ${bindingStr}`);
      }
    }
  } catch (e) {
    // Silently ignore - keybindings setup is non-critical
    logger.debug('Could not set Ctrl+R binding: ' + (e as Error).message);
  }

  await interactive.run();
}
