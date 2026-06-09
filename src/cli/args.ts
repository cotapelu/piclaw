#!/usr/bin/env node
import { logger } from "../utils/logger.js";

export interface Options {
  cwd?: string;
  tools?: string[];
  sessionDir?: string;
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  verbose?: boolean;
  contextLogFile?: string;
  // Session management
  session?: string;
  resume?: boolean;
  continue?: boolean;
  fork?: string;
  // File arguments (positional)
  files?: string[];
  // Mode
  mode?: 'interactive' | 'print' | 'json' | 'rpc';
  // Additional messages (for print/json modes) - via --message flags
  message?: string[];
  // Show usage statistics (tokens, cost) after completion
  stats?: boolean;
  // Resource loading
  noContextFiles?: boolean;
}

export interface PiclawConfig {
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  tools?: string[];
  sessionDir?: string;
  verbose?: boolean;
  contextLogFile?: string;
  noContextFiles?: boolean;
  // Non-persisted flags
  session?: string;
  resume?: boolean;
  continue?: boolean;
  fork?: string;
  files?: string[];
  mode?: 'interactive' | 'print' | 'json' | 'rpc';
  message?: string[];
}

export function parseOptions(args: string[]): { opts: Options; cliOverrides: PiclawConfig } {
  const opts: Options = {};
  const cliOverrides: PiclawConfig = {};

  let i = 0;
  for (; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--cwd':
        if (next) { opts.cwd = next; i++; }
        break;
      case '--tools':
        if (next) { opts.tools = next.split(','); cliOverrides.tools = opts.tools; i++; }
        break;
      case '--sessionDir':
        if (next) { opts.sessionDir = next; cliOverrides.sessionDir = opts.sessionDir; i++; }
        break;
      case '--model':
        if (next) { opts.model = next; cliOverrides.model = opts.model; i++; }
        break;
      case '--thinking':
        if (next) { opts.thinking = next as any; cliOverrides.thinking = opts.thinking; i++; }
        break;
      case '--contextLogFile':
        if (next) { opts.contextLogFile = next; cliOverrides.contextLogFile = opts.contextLogFile; i++; }
        break;
      case '--no-context-files':
        opts.noContextFiles = true;
        cliOverrides.noContextFiles = true;
        break;
      case '--session':
        if (next) { opts.session = next; i++; }
        break;
      case '--resume':
        opts.resume = true;
        break;
      case '--continue':
        opts.continue = true;
        break;
      case '--fork':
        if (next) { opts.fork = next; i++; }
        break;
      case '--mode':
        if (next && (next === 'interactive' || next === 'print' || next === 'json' || next === 'rpc')) {
          opts.mode = next;
          i++;
        } else {
          logger.warn(`Invalid mode: ${next}. Use interactive, print, json, or rpc.`);
        }
        break;
      case '--message':
        if (next) {
          if (!opts.message) opts.message = [];
          opts.message!.push(next);
          i++;
        }
        break;
      case '--verbose':
        opts.verbose = true;
        cliOverrides.verbose = true;
        break;
      case '--stats':
        opts.stats = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          logger.warn(`Unknown flag: ${arg}, ignoring.`);
        } else {
          // Positional args: files and/or text
          if (!opts.files) opts.files = [];
          opts.files.push(arg);
        }
        break;
    }
  }

  return { opts, cliOverrides };
}

function printHelp(): void {
  logger.log(`
Piclaw CLI - AI Coding Assistant

Options:
  --cwd <path>         Working directory
  --tools <list>       Comma-separated tool allowlist
  --sessionDir <dir>   Session directory
  --model <id>         Model to use (e.g., anthropic:claude-opus-4-5)
  --thinking <level>   Thinking level: off|minimal|low|medium|high|xhigh
  --contextLogFile <p> Log LLM context to file
  --verbose            Show detailed logs
  --stats              Show usage statistics (tokens, cost) after completion
  --no-context-files   Disable loading of context files (AGENTS.md, CLAUDE.md, .pi/)
  -h, --help           Show this help

Session Management:
  --session <id>       Open existing session (by id or path)
  --resume             Resume most recent session (with picker)
  --continue           Continue most recent session (no UI)
  --fork <id>          Fork from existing session

Mode:
  --mode <mode>        Mode: interactive (default), print, json, rpc
  --message <text>     Additional message (for print/json modes, can repeat)

File Arguments:
  @<file>             Include file content
  <image-path>        Include image file
  <text>              Literal text

Examples:
  piclaw @notes.txt "Summarize"
  piclaw --mode print @input.txt --message "Explain"
  piclaw --resume
`);
}
