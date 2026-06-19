#!/usr/bin/env node
/**
 * Cache Manager Tool
 *
 * Provides key-value caching with TTL (time-to-live) and persistence.
 * Operations: set, get, delete, clear, keys, stats.
 * Data stored in: ./.piclaw/agent/cache.json (per-session)
 *
 * Use cases:
 * - Cache HTTP responses to reduce API calls
 * - Store computed results for reuse
 * - Avoid redundant expensive operations
 */

import { existsSync, mkdirSync, promises as fs, unlink } from "node:fs";
import { dirname, join } from "node:path";
import type { ToolDefinition, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { createLogger } from "../utils/logger.js";
import { Mutex } from "../utils/mutex.js";
import { CONFIG_DIR_NAME } from "../../config/config-manager.js";

const logger = createLogger("cache-manager");

// Per-session state
interface CacheEntry {
  value: any;
  createdAt: number;
  expiresAt?: number; // optional TTL in ms since createdAt
}

interface PersistedCache {
  version: 1;
  entries: Record<string, {
    value: any;
    createdAt: number;
    expiresAt?: number;
  }>;
}

class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private mutex: Mutex;
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.mutex = new Mutex();
  }

  async loadFromFile(): Promise<boolean> {
    const release = await this.mutex.lock();
    try {
      const filePath = this.getCacheFilePath();
      if (!existsSync(filePath)) return false;
      const content = await fs.readFile(filePath, "utf-8");
      const parsed: PersistedCache = JSON.parse(content);
      if (parsed.version !== 1) return false;
      const now = Date.now();
      this.cache.clear();
      for (const [key, entry] of Object.entries(parsed.entries)) {
        if (entry.expiresAt && entry.expiresAt < now) continue;
        this.cache.set(key, { ...entry });
      }
      logger.debug(`Loaded ${this.cache.size} cache entries (skipped expired)`);
      return true;
    } catch (e) {
      logger.error("Load cache failed:", e);
      return false;
    } finally {
      release();
    }
  }

  async saveToFile(): Promise<void> {
    const release = await this.mutex.lock();
    try {
      const filePath = this.getCacheFilePath();
      const dir = dirname(filePath);
      if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
      const entries: Record<string, { value: any; createdAt: number; expiresAt?: number }> = {};
      for (const [key, entry] of this.cache.entries()) {
        entries[key] = { ...entry };
      }
      const persisted: PersistedCache = { version: 1, entries };
      const tempPath = filePath + `.tmp.${Date.now()}.${process.pid}.json`;
      await fs.writeFile(tempPath, JSON.stringify(persisted, null, 2));
      await fs.rename(tempPath, filePath);
    } finally {
      release();
    }
  }

  private getCacheFilePath(): string {
    return join(this.cwd, CONFIG_DIR_NAME, "agent", "cache.json");
  }

  // Operations --------------------------------------------------

  async set(key: string, value: any, ttlMs?: number): Promise<void> {
    const release = await this.mutex.lock();
    try {
      const now = Date.now();
      const entry: CacheEntry = { value, createdAt: now };
      if (ttlMs != null && ttlMs > 0) entry.expiresAt = now + ttlMs;
      this.cache.set(key, entry);
    } finally {
      release();
    }
    this.saveToFile().catch(() => {});
  }

  async get(key: string): Promise<{ found: boolean; value: any; expired?: boolean }> {
    const release = await this.mutex.lock();
    try {
      const entry = this.cache.get(key);
      if (!entry) return { found: false, value: undefined };
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        return { found: false, value: undefined, expired: true };
      }
      return { found: true, value: entry.value };
    } finally {
      release();
    }
  }

  async delete(key: string): Promise<boolean> {
    const release = await this.mutex.lock();
    try {
      return this.cache.delete(key);
    } finally {
      release();
    }
  }

  async clear(): Promise<void> {
    const release = await this.mutex.lock();
    try {
      this.cache.clear();
    } finally {
      release();
    }
    // Remove persisted file
    try {
      const filePath = this.getCacheFilePath();
      if (existsSync(filePath)) unlink(filePath, () => {});
    } catch {}
  }

  async keys(pattern?: string): Promise<string[]> {
    const release = await this.mutex.lock();
    try {
      const keys = Array.from(this.cache.keys());
      if (!pattern) return keys;
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      return keys.filter(k => regex.test(k));
    } finally {
      release();
    }
  }

  async stats(): Promise<{ total: number; expired: number; memoryUsageBytes: number }> {
    const release = await this.mutex.lock();
    try {
      let expired = 0;
      const now = Date.now();
      for (const entry of this.cache.values()) {
        if (entry.expiresAt && entry.expiresAt < now) expired++;
      }
      let bytes = 0;
      for (const [key, entry] of this.cache) {
        bytes += key.length * 2;
        try { bytes += JSON.stringify(entry).length; } catch { bytes += 50; }
      }
      return { total: this.cache.size, expired, memoryUsageBytes: bytes };
    } finally {
      release();
    }
  }

  async cleanupExpired(): Promise<number> {
    const release = await this.mutex.lock();
    try {
      const now = Date.now();
      let removed = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt && entry.expiresAt < now) {
          this.cache.delete(key);
          removed++;
        }
      }
      return removed;
    } finally {
      release();
    }
  }
}

// Session state management
const sessionManagers = new WeakMap<ExtensionContext, CacheManager>();

function getCacheManager(ctx: ExtensionContext): CacheManager {
  let mgr = sessionManagers.get(ctx);
  if (!mgr) {
    mgr = new CacheManager(ctx.cwd);
    sessionManagers.set(ctx, mgr);
  }
  return mgr;
}

// ============================================================================
// Tool Definition
// ============================================================================

export async function executeCacheManager(
  toolCallId: string,
  params: any,
  signal: AbortSignal | undefined,
  onUpdate: any,
  ctx: ExtensionContext
): Promise<{
  isError: boolean;
  content: Array<{ type: "text", text: string }>;
  details: any;
}> {
  const mgr = getCacheManager(ctx);
  const action = params.action;
  const key = params.key;
  const value = params.value;
  const ttl = params.ttl; // milliseconds
  const pattern = params.pattern;

  // Validate action
  const validActions = ["set", "get", "delete", "clear", "keys", "stats", "cleanup"];
  if (!action || !validActions.includes(action)) {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid action: ${action}. Valid actions: ${validActions.join(", ")}` }],
      details: { error: "Invalid action" },
    };
  }

  try {
    switch (action) {
      case "set": {
        if (typeof key !== "string" || !key) {
          return { isError: true, content: [{ type: "text", text: "set requires 'key' (non-empty string)" }], details: { error: "Missing key" } };
        }
        if (value === undefined) {
          return { isError: true, content: [{ type: "text", text: "set requires 'value'" }], details: { error: "Missing value" } };
        }
        await mgr.set(key, value, ttl != null ? Number(ttl) : undefined);
        return {
          isError: false,
          content: [{ type: "text", text: `Cache set: ${key}` }],
          details: { key, ttl },
        };
      }

      case "get": {
        if (typeof key !== "string" || !key) {
          return { isError: true, content: [{ type: "text", text: "get requires 'key' (non-empty string)" }], details: { error: "Missing key" } };
        }
        const result = await mgr.get(key);
        if (!result.found) {
          return {
            isError: false,
            content: [{ type: "text", text: `Cache miss: ${key}${result.expired ? " (expired)" : ""}` }],
            details: { key, found: false, expired: result.expired },
          };
        }
        return {
          isError: false,
          content: [{ type: "text", text: `Cache hit: ${key}` }],
          details: { key, found: true, value: result.value },
        };
      }

      case "delete": {
        if (typeof key !== "string" || !key) {
          return { isError: true, content: [{ type: "text", text: "delete requires 'key' (non-empty string)" }], details: { error: "Missing key" } };
        }
        const deleted = await mgr.delete(key);
        return {
          isError: false,
          content: [{ type: "text", text: deleted ? `Deleted: ${key}` : `Key not found: ${key}` }],
          details: { key, deleted },
        };
      }

      case "clear": {
        await mgr.clear();
        return {
          isError: false,
          content: [{ type: "text", text: "Cache cleared" }],
          details: {},
        };
      }

      case "keys": {
        const keys = await mgr.keys(pattern);
        return {
          isError: false,
          content: [{ type: "text", text: `Keys (${keys.length}):\n` + (keys.length ? keys.join("\n") : "(empty)") }],
          details: { keys, pattern },
        };
      }

      case "stats": {
        const stats = await mgr.stats();
        return {
          isError: false,
          content: [{ type: "text", text: `Cache stats:\n  Total entries: ${stats.total}\n  Expired: ${stats.expired}\n  Memory (est.): ${(stats.memoryUsageBytes / 1024).toFixed(1)} KB` }],
          details: stats,
        };
      }

      case "cleanup": {
        const removed = await mgr.cleanupExpired();
        return {
          isError: false,
          content: [{ type: "text", text: `Cleanup removed ${removed} expired entries` }],
          details: { removed },
        };
      }
    }
  } catch (error: any) {
    logger.error("Cache manager error:", error);
    return {
      isError: true,
      content: [{ type: "text", text: `Cache error: ${error.message}` }],
      details: { error: error.message },
    };
  }
  // Should not reach here
  return { isError: true, content: [{ type: "text", text: "Unknown error" }], details: {} };
}

/**
 * Register the cache manager tool.
 */
export function registerCacheManagerTool(api: ExtensionAPI): void {
  const tool: ToolDefinition = {
    name: "cache_manager",
    label: "Cache Manager",
    description: "Key-value cache with TTL and persistence. Use to store and retrieve data across agent turns.",
    promptSnippet: "cache_manager({ action: 'set'|'get'|'delete'|'clear'|'keys'|'stats'|'cleanup', key?: string, value?: any, ttl?: number, pattern?: string })",
    promptGuidelines: [
      "Cache Manager provides persistent key-value storage with optional TTL (time-to-live).",
      "Actions:",
      "  set(key, value, ttlMs?) - store a value. TTL in milliseconds (e.g., 60000 = 1 minute).",
      "  get(key) - retrieve a value; returns cache miss if not found or expired.",
      "  delete(key) - remove a key.",
      "  clear() - remove all entries.",
      "  keys(pattern?) - list keys, optionally with glob pattern (* and ? supported).",
      "  stats() - show total entries, expired count, memory estimate.",
      "  cleanup() - manually remove expired entries.",
      "Cache is session-scoped and persisted to ./.piclaw/agent/cache.json automatically.",
      "Use to cache HTTP responses (from http-client), expensive calculations, or intermediate results."
    ],
    parameters: {}, // Manual validation in execute
    execute: executeCacheManager,
    renderResult: (result: any, _options: any, theme: any) => {
      const content = result.content?.[0]?.text || result.details?.error || 'No output';
      return new Text(content);
    },
  };

  api.registerTool(tool);
  logger.info("Cache manager tool registered");
}

// Export for testing
export { CacheManager };

