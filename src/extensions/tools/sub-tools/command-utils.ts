#!/usr/bin/env node

/**
 * Command utilities for safe execution.
 * Provides functions to build argument arrays without shell injection.
 */

/**
 * Split a command string into an array of arguments.
 * Simple implementation that handles single and double quotes.
 * Does not support escape sequences within quotes (e.g., \") but good enough for LLM output.
 */
export function splitCommand(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if ((c === '"' || c === "'") && !inQuote) {
      inQuote = true;
      quoteChar = c;
    } else if (c === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (c === ' ' && !inQuote) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    } else {
      current += c;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Escape a string for safe inclusion in a shell command.
 * Wraps in single quotes and escapes embedded single quotes.
 * Note: Prefer using direct exec with arg arrays over shell escaping.
 */
export function escapeShellArg(arg: string): string {
  // Replace each single quote with: '\'' (close, escaped quote, reopen)
  // Then wrap whole thing in single quotes.
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Build a safe argument array for a tool that takes a command sub-string.
 * Splits the command string and returns an array starting with the tool name.
 */
export function buildToolArgs(tool: string, command: string): string[] {
  return [tool, ...splitCommand(command)];
}

/**
 * Build SSH argument array.
 * Avoids shell injection by passing args directly to ssh.
 */
export function buildSshArgs(host: string, remoteCommand: string, user?: string, port: number = 22): string[] {
  const args: string[] = ['-p', String(port)];
  if (user) {
    args.push('-l', user);
  }
  const target = user ? `${user}@${host}` : host;
  args.push(target, remoteCommand);
  return args;
}

/**
 * Build a generic argument array from a mapping.
 * Useful for tools with multiple optional flags.
 */
export function buildArgsFromMapping(
  base: string,
  mapping: Array<{ value?: any; flag?: string; isArray?: boolean }>
): string[] {
  const args: string[] = [base];
  for (const { value, flag, isArray } of mapping) {
    if (value === undefined || value === null) continue;
    if (isArray && Array.isArray(value)) {
      for (const v of value) {
        if (flag) args.push(flag);
        args.push(String(v));
      }
    } else {
      if (flag) args.push(flag);
      args.push(String(value));
    }
  }
  return args;
}
