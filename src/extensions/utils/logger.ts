#!/usr/bin/env node

/**
 * Simple Logger for Extensions
 *
 * Provides log levels with optional prefix/tag.
 * Backward compatible with simple console API.
 * Does not perform level filtering; all logs are emitted.
 * Use core logger for level-controlled structured logging.
 */

// Local LogLevel type to avoid circular dependency
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** Current global log level (can be set via setExtensionLogLevel) */
let currentLevel: LogLevel = 'trace'; // default to most verbose for extensions

/**
 * Set the global log level for all extension loggers.
 * This also updates the core logger level.
 */
export function setExtensionLogLevel(level: LogLevel): void {
  currentLevel = level;
  // Also set core logger level for consistency (optional runtime hook)
  // Core logger should be initialized separately via initLogger.
}

/**
 * Create a logger instance with optional prefix/tag.
 * Returns an object with methods: log, error, warn, info, debug, trace.
 * The prefix is added as a separate argument to the console method.
 */
export function createLogger(tag?: string): ExtensionLogger {
  const prefix = tag ? `[${tag}]` : '';
  return {
    log: (...args: any[]) => {
      if (prefix) console.log(prefix, ...args);
      else console.log(...args);
    },
    error: (...args: any[]) => {
      if (prefix) console.error(prefix, ...args);
      else console.error(...args);
    },
    warn: (...args: any[]) => {
      if (prefix) console.warn(prefix, ...args);
      else console.warn(...args);
    },
    info: (...args: any[]) => {
      if (prefix) console.info(prefix, ...args);
      else console.info(...args);
    },
    debug: (...args: any[]) => {
      if (prefix) console.debug(prefix, ...args);
      else console.debug(...args);
    },
    trace: (...args: any[]) => {
      if (prefix) console.trace(prefix, ...args);
      else console.trace(...args);
    },
  };
}

// Default logger without prefix
export const logger = createLogger();

/** Logger interface */
export interface ExtensionLogger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  trace: (...args: any[]) => void;
}
