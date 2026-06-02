#!/usr/bin/env node

/**
 * Session Resolver
 *
 * Resolves session flags (--session, --resume, --fork, --continue) into
 * a SessionManager instance. Uses only public API.
 */

import { SessionManager } from "@earendil-works/pi-coding-agent";
import { logger } from "./utils/logger.js";
import { promptConfirm, promptWithDefault } from "./utils/prompt.js";

/**
 * Result of resolving a session argument
 */
export type ResolvedSession =
  | { type: "local"; path: string; sessionId: string }
  | { type: "global"; path: string; sessionId: string; cwd: string }
  | { type: "not_found"; arg: string };

/**
 * Options for session resolution
 */
export interface SessionResolverOptions {
  cwd: string;
  sessionDir?: string;
  session?: string;
  resume?: boolean;
  continue?: boolean;
  fork?: string;
  interactive: boolean;
}

/**
 * Resolve a session argument (id or path) to a session file path.
 */
export async function resolveSessionArgument(
  arg: string,
  cwd: string,
  sessionDir?: string
): Promise<ResolvedSession> {
  const path = require("node:path");
  const fs = require("node:fs");

  // If looks like file path (contains slash or ends with .jsonl)
  if (arg.includes("/") || arg.includes("\\") || arg.endsWith(".jsonl")) {
    const resolvedPath = path.isAbsolute(arg) ? arg : path.join(cwd, arg);
    return { type: "local", path: resolvedPath, sessionId: path.basename(resolvedPath, ".jsonl") };
  }

  // Search local sessions first
  try {
    const localSessions = await SessionManager.list(cwd, sessionDir);
    const localMatches = localSessions.filter((s: { id: string }) => s.id.startsWith(arg));
    if (localMatches.length >= 1) {
      const match = localMatches[0];
      return { type: "local", path: match.path, sessionId: match.id };
    }
  } catch (error) {
    logger.debug("Local session list failed", { error });
  }

  // Search global sessions
  try {
    const allSessions = await SessionManager.listAll();
    const globalMatches = allSessions.filter((s: { id: string }) => s.id.startsWith(arg));
    if (globalMatches.length >= 1) {
      const match = globalMatches[0];
      return { type: "global", path: match.path, sessionId: match.id, cwd: match.cwd };
    }
  } catch (error) {
    logger.debug("Global session list failed", { error });
  }

  return { type: "not_found", arg };
}

/**
 * Interactive session selector (console-based fallback)
 */
export async function selectSessionInteractive(
  sessions: Array<{ id: string; path: string }>,
  cwd: string
): Promise<string | undefined> {
  if (sessions.length === 0) {
    logger.log("No sessions found.");
    return undefined;
  }

  logger.log(`\nFound ${sessions.length} session(s) in current project:\n`);
  for (let i = 0; i < sessions.length; i++) {
    logger.log(`  ${i + 1}. ${sessions[i].id}`);
  }
  logger.log("");

  const choice = await promptWithDefault(
    `Select session (1-${sessions.length}), or press Enter to cancel: `,
    ""
  );

  if (!choice) return undefined;

  const index = parseInt(choice, 10) - 1;
  if (index >= 0 && index < sessions.length) {
    return sessions[index].path;
  }

  logger.warn(`Invalid selection: ${choice}`);
  return undefined;
}

/**
 * Main resolver: Determine which SessionManager to use based on flags.
 */
export async function resolveSessionManager(
  opts: SessionResolverOptions
): Promise<SessionManager> {
  const { cwd, sessionDir, interactive } = opts;

  // Validate: only one session flag allowed
  const sessionFlags = [opts.session, opts.resume, opts.continue, opts.fork].filter(Boolean);
  if (sessionFlags.length > 1) {
    throw new Error(
      `Conflicting session flags: only one of --session, --resume, --continue, --fork may be used. Got: ${sessionFlags.join(", ")}`
    );
  }

  // Priority: continue > resume > fork > session > create

  if (opts.continue) {
    // Continue most recent session (non-interactive)
    try {
      const recent = await SessionManager.continueRecent(cwd, sessionDir);
      if (!recent) {
        throw new Error("No recent session found. Use --resume to select interactively.");
      }
      logger.info(`Continuing session: ${recent.getSessionId()}`);
      return recent;
    } catch (error: any) {
      throw new Error(`Failed to continue session: ${error.message}`);
    }
  }

  if (opts.resume) {
    // Resume with interactive selector
    try {
      const sessions = await SessionManager.list(cwd, sessionDir);
      if (sessions.length === 0) {
        throw new Error("No sessions found in current project.");
      }

      const selectedPath = interactive
        ? await selectSessionInteractive(sessions, cwd)
        : sessions[0].path;

      if (!selectedPath) {
        throw new Error("No session selected.");
      }

      const opened = SessionManager.open(selectedPath, sessionDir);
      logger.info(`Resumed session: ${opened.getSessionId()}`);
      return opened;
    } catch (error: any) {
      throw new Error(`Failed to resume session: ${error.message}`);
    }
  }

  if (opts.fork) {
    // Fork from existing session
    const resolved = await resolveSessionArgument(opts.fork, cwd, sessionDir);
    if (resolved.type === "not_found") {
      throw new Error(`Session not found: ${opts.fork}`);
    }

    if (resolved.type === "global" && interactive) {
      const shouldFork = await promptConfirm(
        `Session "${resolved.sessionId}" found in different project (${resolved.cwd}). Fork it into current directory?`
      );
      if (!shouldFork) {
        throw new Error("Fork cancelled.");
      }
    }

    try {
      const forked = SessionManager.forkFrom(resolved.path, cwd, sessionDir);
      logger.info(`Forked session ${resolved.sessionId} → ${forked.getSessionId()}`);
      return forked;
    } catch (error: any) {
      throw new Error(`Failed to fork session: ${error.message}`);
    }
  }

  if (opts.session) {
    // Open specific session
    const resolved = await resolveSessionArgument(opts.session, cwd, sessionDir);
    if (resolved.type === "not_found") {
      throw new Error(`Session not found: ${opts.session}`);
    }

    try {
      const opened = SessionManager.open(resolved.path, sessionDir);
      logger.info(`Opened session: ${opened.getSessionId()}`);
      return opened;
    } catch (error: any) {
      throw new Error(`Failed to open session: ${error.message}`);
    }
  }

  // Default: create new session
  try {
    const created = SessionManager.create(cwd, sessionDir);
    logger.debug(`Created new session: ${created.getSessionId()}`);
    return created;
  } catch (error: any) {
    throw new Error(`Failed to create session: ${error.message}`);
  }
}

/**
 * Validation helper
 */
export function validateSessionFlags(
  opts: Pick<SessionResolverOptions, "session" | "resume" | "continue" | "fork">
): void {
  const sessionFlags = [opts.session, opts.resume, opts.continue, opts.fork].filter(Boolean);
  if (sessionFlags.length > 1) {
    const flagNames: string[] = [];
    if (opts.session) flagNames.push("--session");
    if (opts.resume) flagNames.push("--resume");
    if (opts.continue) flagNames.push("--continue");
    if (opts.fork) flagNames.push("--fork");
    throw new Error(`Conflicting session flags: ${flagNames.join(", ")}. Use only one.`);
  }
}
