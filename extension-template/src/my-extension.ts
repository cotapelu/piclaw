#!/usr/bin/env node

/**
 * My Extension - Template
 *
 * This is a starter template for creating custom PiClaw extensions.
 * It demonstrates how to register a simple tool and a slash command.
 *
 * To use:
 * 1. Copy this folder into your project's `src/extensions/` directory.
 * 2. In `src/extensions/factory.ts`, import and call `extensionsAggregator` from this extension.
 * 3. Rebuild and restart PiClaw.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Main aggregator function called by the extension loader.
 * Register your tools, commands, renderers, etc. here.
 */
export default function extensionsAggregator(api: ExtensionAPI): void {
  // Register a simple tool that returns a greeting
  api.registerTool({
    name: "my-greeting",
    label: "My Greeting",
    description: "A simple tool that says hello. Use it to test your extension setup.",
    promptSnippet: "my-greeting()",
    promptGuidelines: [
      "This tool takes no parameters.",
      "It returns a friendly greeting message.",
    ],
    parameters: {},
    async execute(_toolCallId: string, _params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: any) {
      // Your tool logic goes here
      return {
        isError: false,
        content: [{ type: "text", text: "👋 Hello from my custom extension!" }],
        details: { message: "Hello" },
      };
    },
  });

  // Register a simple slash command
  api.registerCommand("hello", {
    description: "Greet the user with a friendly notification",
    handler: async (_args: string, ctx: any) => {
      // You can use ctx.ui.notify to show notifications
      ctx.ui.notify("🎉 Hello, world! This is a custom command.", "info");
    },
  });
}
