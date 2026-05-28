#!/usr/bin/env node
import { logger } from "../utils/logger.js";

/**
 * CLI Argument Parser for Piclaw
 *
 * Parses command-line arguments and returns options and config overrides.
 */

export interface Options {
  cwd?: string;
  tools?: string[];
  sessionDir?: string;
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  verbose?: boolean;
  contextLogFile?: string;
}

export interface PiclawConfig {
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  tools?: string[];
  sessionDir?: string;
  verbose?: boolean;
  contextLogFile?: string;
}

/**
 * Parse command-line arguments.
 * @param args - Command line arguments (excluding node and script)
 * @returns Object with opts and cliOverrides
 */
export function parseOptions(args: string[]): { opts: Options; cliOverrides: PiclawConfig } {
  const opts: Options = {};
  const cliOverrides: PiclawConfig = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cwd" && args[i + 1]) opts.cwd = args[++i];
    if (args[i] === "--tools" && args[i + 1]) {
      opts.tools = args[i + 1].split(",");
      cliOverrides.tools = opts.tools;
    }
    if (args[i] === "--sessionDir" && args[i + 1]) {
      opts.sessionDir = args[++i];
      cliOverrides.sessionDir = opts.sessionDir;
    }
    if (args[i] === "--model" && args[i + 1]) {
      opts.model = args[++i];
      cliOverrides.model = opts.model;
    }
    if (args[i] === "--thinking" && args[i + 1]) {
      opts.thinking = args[++i] as any;
      cliOverrides.thinking = opts.thinking;
    }
    if (args[i] === "--contextLogFile" && args[i + 1]) {
      opts.contextLogFile = args[++i];
      cliOverrides.contextLogFile = opts.contextLogFile;
    }
    if (args[i] === "--verbose") {
      opts.verbose = true;
      cliOverrides.verbose = true;
    }
    if (args[i] === "-h" || args[i] === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  return { opts, cliOverrides };
}

/**
 * Print help message
 */
function printHelp(): void {
  logger.log(`
Piclaw CLI - AI Coding Assistant

Options:
  --cwd <path>         Working directory (default: process.cwd())
  --tools <list>       Comma-separated tool allowlist
  --sessionDir <dir>   Session directory
  --model <id>         Model to use (e.g., anthropic:claude-opus-4-5)
  --thinking <level>   Thinking level: off|minimal|low|medium|high|xhigh
  --contextLogFile <p> Log LLM context to file (for debugging)
  --verbose            Show detailed logs
  -h, --help           Show this help
`);
}
