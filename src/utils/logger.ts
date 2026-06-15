#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Structured Logger for Piclaw
 *
 * Provides log levels (trace, debug, info, warn, error) with consistent formatting.
 * Can be configured via environment variable `PICLAW_LOG_LEVEL` or config file (~/.piclaw/config.json -> logLevel).
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const DEFAULT_LEVEL: LogLevel = 'info';

// Singleton instance per process
let currentLevel: LogLevel = DEFAULT_LEVEL;
let quietMode = false;

/**
 * Set the global log level.
 * Call once at startup after loading config.
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Enable/disable quiet mode (suppresses all logs).
 */
export function setQuietMode(quiet: boolean): void {
  quietMode = quiet;
}

/**
 * Get current log level.
 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

/**
 * Format a log line as a single string.
 */
function formatLog(level: string, args: any[]): string {
  const timestamp = new Date().toISOString();
  const message = args.map(String).join(' ');
  return `[${level}] ${timestamp} ${message}`;
}

/**
 * Logger instance with methods for each level.
 */
export const logger = {
  trace: (...args: any[]) => {
    if (currentLevel === 'trace' && !quietMode) {
      console.log(formatLog('TRACE', args));
    }
  },

  debug: (...args: any[]) => {
    if (['trace', 'debug'].includes(currentLevel) && !quietMode) {
      console.log(formatLog('DEBUG', args));
    }
  },

  info: (...args: any[]) => {
    if (['trace', 'debug', 'info'].includes(currentLevel) && !quietMode) {
      console.log(formatLog('INFO', args));
    }
  },

  warn: (...args: any[]) => {
    if (['trace', 'debug', 'info', 'warn'].includes(currentLevel) && !quietMode) {
      console.warn(formatLog('WARN', args));
    }
  },

  error: (...args: any[]) => {
    if (['trace', 'debug', 'info', 'warn', 'error'].includes(currentLevel) && !quietMode) {
      console.error(formatLog('ERROR', args));
    }
  },

  // Alias for info for backward compatibility
  log: (...args: any[]) => {
    if (['trace', 'debug', 'info'].includes(currentLevel) && !quietMode) {
      console.log(formatLog('LOG', args));
    }
  },

  // Structured logging helper
  structured: (level: LogLevel, data: Record<string, any>) => {
    if (level === 'trace' && currentLevel !== 'trace') return;
    if (level === 'debug' && !['trace', 'debug'].includes(currentLevel)) return;
    if (level === 'info' && !['trace', 'debug', 'info'].includes(currentLevel)) return;
    if (level === 'warn' && !['trace', 'debug', 'info', 'warn'].includes(currentLevel)) return;
    if (level === 'error' && !['trace', 'debug', 'info', 'warn', 'error'].includes(currentLevel)) return;

    if (quietMode) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...data,
    };
    // Use JSON for structured logs; fallback to console.log
    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
};

/**
 * Initialize logger from environment, config file, or default.
 * Checks: 1) env.logLevel parameter, 2) PICLAW_LOG_LEVEL env var, 3) ~/.piclaw/config.json, 4) default.
 */
export async function initLogger(env?: { logLevel?: string }): Promise<void> {
  let level: LogLevel | null = null;

  // 1) Explicit env parameter
  if (env?.logLevel && ['trace', 'debug', 'info', 'warn', 'error'].includes(env.logLevel)) {
    level = env.logLevel as LogLevel;
  }
  // 2) Environment variable
  else if (process.env.PICLAW_LOG_LEVEL && ['trace', 'debug', 'info', 'warn', 'error'].includes(process.env.PICLAW_LOG_LEVEL)) {
    level = process.env.PICLAW_LOG_LEVEL as LogLevel;
  }

  // 3) Config file (~/.piclaw/config.json)
  if (!level) {
    try {
      const configPath = join(homedir(), ".piclaw", "config.json");
      const data = await readFile(configPath, "utf-8");
      const config = JSON.parse(data);
      if (config.logLevel && ['trace', 'debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
        level = config.logLevel as LogLevel;
      }
    } catch {
      // ignore errors, fall back to default
    }
  }

  currentLevel = level || DEFAULT_LEVEL;
  // Use the logger to output initialization message
  logger.info(`Logger initialized at level: ${currentLevel}`);
}

/**
 * Create a logger instance with optional prefix/tag.
 * Useful for component-scoped loggers.
 */
export function createLogger(tag?: string): typeof logger {
  const prefix = tag ? `[${tag}]` : '';
  return {
    trace: (...args: any[]) => {
      if (currentLevel === 'trace' && !quietMode) {
        console.log(formatLog('TRACE', prefix ? [prefix, ...args] : args));
      }
    },
    debug: (...args: any[]) => {
      if (['trace','debug'].includes(currentLevel) && !quietMode) {
        console.log(formatLog('DEBUG', prefix ? [prefix, ...args] : args));
      }
    },
    info: (...args: any[]) => {
      if (['trace','debug','info'].includes(currentLevel) && !quietMode) {
        console.log(formatLog('INFO', prefix ? [prefix, ...args] : args));
      }
    },
    warn: (...args: any[]) => {
      if (['trace','debug','info','warn'].includes(currentLevel) && !quietMode) {
        console.warn(formatLog('WARN', prefix ? [prefix, ...args] : args));
      }
    },
    error: (...args: any[]) => {
      if (['trace','debug','info','warn','error'].includes(currentLevel) && !quietMode) {
        console.error(formatLog('ERROR', prefix ? [prefix, ...args] : args));
      }
    },
    log: (...args: any[]) => {
      if (['trace','debug','info'].includes(currentLevel) && !quietMode) {
        console.log(formatLog('LOG', prefix ? [prefix, ...args] : args));
      }
    },
    structured: (level: LogLevel, data: Record<string, any>) => {
      if (level === 'trace' && currentLevel !== 'trace') return;
      if (level === 'debug' && !['trace','debug'].includes(currentLevel)) return;
      if (level === 'info' && !['trace','debug','info'].includes(currentLevel)) return;
      if (level === 'warn' && !['trace','debug','info','warn'].includes(currentLevel)) return;
      if (level === 'error' && !['trace','debug','info','warn','error'].includes(currentLevel)) return;
      if (quietMode) return;
      const logEntry = { timestamp: new Date().toISOString(), level, ...data };
      if (level === 'error') console.error(JSON.stringify(logEntry));
      else if (level === 'warn') console.warn(JSON.stringify(logEntry));
      else console.log(JSON.stringify(logEntry));
    }
  };
}
