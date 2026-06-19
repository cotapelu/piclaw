#!/usr/bin/env node
/**
 * Database Client Tool Tests (SQLite)
 *
 * Covers connect, query, execute, close.
 */

import { test, expect, describe, beforeEach, afterEach } from "vitest";
import { Database } from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync, existsSync, rmSync, unlink } from "node:fs";
import { tmpdir } from "node:os";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { executeDbClient, DbConnection } from "../extensions/tools/db-client-tool.js";

function createContext(cwd: string): ExtensionContext {
  return {
    ui: {} as any,
    mode: "tui",
    hasUI: true,
    cwd,
    sessionManager: {} as any,
    modelRegistry: {} as any,
    model: undefined,
    isIdle: () => true,
    isProjectTrusted: () => true,
    signal: undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  };
}

describe("DB Client Tool (SQLite)", () => {
  let dbPath: string;
  let ctx: ExtensionContext;

  beforeEach(() => {
    dbPath = join(tmpdir(), "db-test-" + Date.now() + ".db");
    ctx = createContext(tmpdir());
  });

  afterEach(() => {
    try { if (existsSync(dbPath)) unlink(dbPath, () => {}); } catch {}
  });

  describe("connect", () => {
    test("connects to a new database file", async () => {
      const res = await executeDbClient("id1", { action: "connect", database: dbPath }, undefined, undefined, ctx);
      expect(res.isError).toBe(false);
      expect(res.details.database).toBe(dbPath);
      expect(res.details.connected).toBe(true);
    });

    test("fails when database not provided", async () => {
      const res = await executeDbClient("id1", { action: "connect" }, undefined, undefined, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("requires 'database'");
    });
  });

  describe("query and execute", () => {
    let tableCreated: ReturnType<typeof executeDbClient>;

    beforeEach(async () => {
      await executeDbClient("setup", { action: "connect", database: dbPath }, undefined, undefined, ctx);
      await executeDbClient("setup", { action: "execute", database: dbPath, statement: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)" }, undefined, undefined, ctx);
    });

    afterEach(async () => {
      await executeDbClient("close", { action: "close", database: dbPath }, undefined, undefined, ctx);
    });

    test("inserts and queries rows", async () => {
      // Insert a row
      const insertRes = await executeDbClient("ins", { action: "execute", database: dbPath, statement: "INSERT INTO users (name, age) VALUES (?, ?)", values: ["Alice", 30] }, undefined, undefined, ctx);
      expect(insertRes.isError).toBe(false);
      expect(insertRes.details.affected).toBe(1);
      expect(insertRes.details.lastInsertRowid).toBe(1);

      // Query
      const queryRes = await executeDbClient("sel", { action: "query", database: dbPath, statement: "SELECT * FROM users" }, undefined, undefined, ctx);
      expect(queryRes.isError).toBe(false);
      expect(queryRes.details.count).toBe(1);
      expect(queryRes.details.rows[0].name).toBe("Alice");
      expect(queryRes.details.rows[0].age).toBe(30);
    });

    test("parameterized query with values", async () => {
      // Insert multiple
      await executeDbClient("ins1", { action: "execute", database: dbPath, statement: "INSERT INTO users (name, age) VALUES (?, ?)", values: ["Bob", 25] }, undefined, undefined, ctx);
      await executeDbClient("ins2", { action: "execute", database: dbPath, statement: "INSERT INTO users (name, age) VALUES (?, ?)", values: ["Carol", 40] }, undefined, undefined, ctx);

      const queryRes = await executeDbClient("sel", { action: "query", database: dbPath, statement: "SELECT * FROM users WHERE age > ?", values: [28] }, undefined, undefined, ctx);
      expect(queryRes.details.count).toBe(1);
      expect(queryRes.details.rows[0].name).toBe("Carol");
    });

    test("query without values works", async () => {
      const res = await executeDbClient("sel", { action: "query", database: dbPath, statement: "SELECT COUNT(*) as cnt FROM users" }, undefined, undefined, ctx);
      expect(res.isError).toBe(false);
      expect(res.details.rows[0].cnt).toBe(0);
    });
  });

  describe("close", () => {
    test("closes connection", async () => {
      await executeDbClient("c1", { action: "connect", database: dbPath }, undefined, undefined, ctx);
      const closeRes = await executeDbClient("c2", { action: "close", database: dbPath }, undefined, undefined, ctx);
      expect(closeRes.isError).toBe(false);
      expect(closeRes.details.closed).toBe(true);
    });

    test("close without connect fails", async () => {
      const res = await executeDbClient("c1", { action: "close", database: dbPath }, undefined, undefined, ctx);
      expect(res.isError).toBe(true);
    });
  });

  describe("concurrency", () => {
    test("multiple operations on same connection are serialized", async () => {
      await executeDbClient("c1", { action: "connect", database: dbPath }, undefined, undefined, ctx);
      await executeDbClient("c2", { action: "execute", database: dbPath, statement: "CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)" }, undefined, undefined, ctx);

      // Run many inserts in parallel (they will be serialized by mutex)
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(executeDbClient(`ins${i}`, { action: "execute", database: dbPath, statement: "INSERT INTO items (val) VALUES (?)", values: [`item${i}`] }, undefined, undefined, ctx));
      }
      await Promise.all(promises);

      const countRes = await executeDbClient("cnt", { action: "query", database: dbPath, statement: "SELECT COUNT(*) as cnt FROM items" }, undefined, undefined, ctx);
      expect(countRes.details.rows[0].cnt).toBe(20);
    });
  });
});
