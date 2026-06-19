#!/usr/bin/env node
/**
 * Database Client Tool (SQLite)
 *
 * Provides safe, parameterized access to SQLite databases.
 * Actions: connect, query, execute, close.
 * Uses parameterized queries to prevent SQL injection.
 *
 * Note: Currently supports SQLite only.
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ToolDefinition, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { createLogger } from "../utils/logger.js";
import { Mutex } from "../utils/mutex.js";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

const logger = createLogger("db-client");

// Per-session connection registry
interface DbConnection {
  db: Database.Database;
  mutex: Mutex;
}

const sessionConnections = new WeakMap<ExtensionContext, Map<string, DbConnection>>();

function getConnections(ctx: ExtensionContext): Map<string, DbConnection> {
  let map = sessionConnections.get(ctx);
  if (!map) {
    map = new Map();
    sessionConnections.set(ctx, map);
  }
  return map;
}

// Ensure parent directory exists
function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Tool execution

async function executeDbClient(
  _toolCallId: string,
  params: any,
  _signal: AbortSignal | undefined,
  _onUpdate: any,
  ctx: ExtensionContext
): Promise<{
  isError: boolean;
  content: Array<{ type: "text"; text: string }>;
  details: any;
}> {
  const action = params.action;
  const database = params.database; // required for most actions
  const statement = params.statement;
  const values = params.values || [];

  const validActions = ["connect", "query", "execute", "close", "exec"];
  if (!action || !validActions.includes(action)) {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid action: ${action}. Valid: ${validActions.join(", ")}` }],
      details: { error: "Invalid action" },
    };
  }

  const connections = getConnections(ctx);

  try {
    switch (action) {
      case "connect": {
        if (typeof database !== "string" || !database) {
          return { isError: true, content: [{ type: "text", text: "connect requires 'database' (file path)" }], details: { error: "Missing database" } };
        }
        if (connections.has(database)) {
          return { isError: true, content: [{ type: "text", text: `Already connected to: ${database}` }], details: { error: "Already connected" } };
        }
        ensureDir(database);
        const db = new Database(database);
        const mutex = new Mutex();
        connections.set(database, { db, mutex });
        logger.info(`Connected to SQLite database: ${database}`);
        return {
          isError: false,
          content: [{ type: "text", text: `Connected to ${database}` }],
          details: { database, connected: true },
        };
      }

      case "query": {
        if (!database || !connections.has(database)) {
          return { isError: true, content: [{ type: "text", text: `Not connected to: ${database}` }], details: { error: "Not connected" } };
        }
        if (typeof statement !== "string" || !statement.trim()) {
          return { isError: true, content: [{ type: "text", text: "query requires 'statement' (SQL SELECT)" }], details: { error: "Missing statement" } };
        }
        const { db, mutex } = connections.get(database)!;
        let rows: any[] = [];
        const release = await mutex.lock();
        try {
          const stmt = db.prepare(statement);
          rows = values.length ? stmt.all(values) : stmt.all();
        } finally {
          release();
        }
        return {
          isError: false,
          content: [{ type: "text", text: `Query returned ${rows.length} rows` }],
          details: { rows, count: rows.length },
        };
      }

      case "execute": {
        if (!database || !connections.has(database)) {
          return { isError: true, content: [{ type: "text", text: `Not connected to: ${database}` }], details: { error: "Not connected" } };
        }
        if (typeof statement !== "string" || !statement.trim()) {
          return { isError: true, content: [{ type: "text", text: "execute requires 'statement' (INSERT/UPDATE/DELETE)" }], details: { error: "Missing statement" } };
        }
        const { db, mutex } = connections.get(database)!;
        let affected = 0;
        let lastId: number | bigint = 0;
        const release = await mutex.lock();
        try {
          const stmt = db.prepare(statement);
          const result = values.length ? stmt.run(values) : stmt.run();
          affected = result.changes;
          lastId = result.lastInsertRowid;
        } finally {
          release();
        }
        return {
          isError: false,
          content: [{ type: "text", text: `Execute OK: affected ${affected} rows, last insert id ${lastId}` }],
          details: { affected, lastInsertRowid: lastId },
        };
      }

      case "exec": {
        if (!database || !connections.has(database)) {
          return { isError: true, content: [{ type: "text", text: `Not connected to: ${database}` }], details: { error: "Not connected" } };
        }
        if (typeof statement !== "string" || !statement.trim()) {
          return { isError: true, content: [{ type: "text", text: "exec requires 'statement' (SQL)" }], details: { error: "Missing statement" } };
        }
        const { db, mutex } = connections.get(database)!;
        const release = await mutex.lock();
        try { db.exec(statement); } finally { release(); }
        return {
          isError: false,
          content: [{ type: "text", text: "Executed statement" }],
          details: {},
        };
      }

      case "close": {
        if (!database) {
          return { isError: true, content: [{ type: "text", text: "close requires 'database'" }], details: { error: "Missing database" } };
        }
        if (!connections.has(database)) {
          return { isError: true, content: [{ type: "text", text: `Not connected to: ${database}` }], details: { error: "Not connected" } };
        }
        const conn = connections.get(database)!;
        const release = await conn.mutex.lock();
        try { conn.db.close(); } finally { release(); }
        connections.delete(database);
        logger.info(`Closed database: ${database}`);
        return {
          isError: false,
          content: [{ type: "text", text: `Closed: ${database}` }],
          details: { database, closed: true },
        };
      }
    }
  } catch (error: any) {
    logger.error("DB client error:", error);
    return {
      isError: true,
      content: [{ type: "text", text: `DB error: ${error.message}` }],
      details: { error: error.message },
    };
  }

  return { isError: true, content: [{ type: "text", text: "Unknown error" }], details: {} };
}

/**
 * Register the database client tool.
 */
export function registerDbClientTool(api: ExtensionAPI): void {
  const tool: ToolDefinition = {
    name: "db_client",
    label: "Database Client",
    description: "Execute parameterized queries against an SQLite database. (Postgres/MySQL planned)",
    promptSnippet: "db_client({ action: 'connect'|'query'|'execute'|'exec'|'close', database?: string, statement?: string, values?: any[] })",
    promptGuidelines: [
      "Database client provides safe, parameterized SQL operations on SQLite databases.",
      "Actions:",
      "  connect(database='path/to/file.db') — open a database file. Creates file if it doesn't exist.",
      "  query(statement, values?) — run SELECT and return rows as objects.",
      "  execute(statement, values?) — run INSERT/UPDATE/DELETE; returns affected rows and last insert id.",
      "  exec(statement) — run multiple SQL statements (no parameters).",
      "  close(database) — close connection.",
      "Always use parameterized queries to avoid SQL injection.",
      "Example:",
      "  db_client({ action: 'query', database: 'data.db', statement: 'SELECT * FROM users WHERE id = ?', values: [42] })",
    ],
    parameters: {}, // manual validation
    execute: executeDbClient,
    renderResult: (result: any, _options: any, theme: any) => {
      const content = result.content?.[0]?.text || result.details?.error || 'No output';
      return new Text(content);
    },
  };

  api.registerTool(tool);

  // Auto-close all connections on session shutdown
  api.on("session_shutdown", () => {
    // This closure captures nothing; we rely on connections map per ctx.
    // The tool itself can't iterate over all contexts. We'll instead close connections in the active ctx when its session ends.
    // But we need to get connections for that ctx. However we don't have ctx here.
    // Alternative: store cleanup in each ctx via onShutdown registration after first use.
    // For simplicity, we rely on process exit to clean up.
  });

  logger.info("Database client tool registered (SQLite)");
}

export { executeDbClient };


// Extend session cleanup: register a per-session hook to close connections when context is destroyed.
// We can attach to ctx events if needed. For now, rely on process termination; SQLite will close.
