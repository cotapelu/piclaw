#!/usr/bin/env node

/**
 * Piclaw Core Bootstrapping
 *
 * Handles session resolution, runtime creation, and model setup.
 * Uses only public API from @earendil-works/pi-coding-agent.
 */

import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
  AgentSessionRuntime,
  createAgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getResourceLoaderOptions } from "./extensions/index.js";

// Session resolution (our own implementation - inspired by reading llm-context)
import { resolveSessionManager } from "./session-resolver.js";

// Model scoping (our own implementation - inspired by reading llm-context)
import { setupModelScoping } from "./model-scoper.js";

// Package manager
import { PiclawPackageManager } from "./piclaw-package-manager.js";

// Config & logging
import { getAgentDir } from "./config/config-manager.js";
import { getDefaultContextLogFile } from "./config/config-manager.js";
import { createContextLoggingStreamFn } from "./utils/context-logger.js";
import { logger } from "./utils/logger.js";

// Augment DefaultResourceLoaderOptions to support custom package manager
declare module "@earendil-works/pi-coding-agent/dist/core/resource-loader.js" {
  interface DefaultResourceLoaderOptions {
    packageManager?: import("./piclaw-package-manager.js").PiclawPackageManager;
  }
}

// Local interface for session manager with parentRuntime
interface SessionManagerWithParent extends SessionManager {
  parentRuntime?: AgentSessionRuntime;
}

/**
 * Options for bootPiclaw
 */
export interface PiclawCoreOptions {
  cwd?: string;
  agentDir?: string;
  sessionDir?: string;
  tools?: string[];
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  verbose?: boolean;
  contextLogFile?: string;
  // Session flags
  session?: string;
  resume?: boolean;
  continue?: boolean;
  fork?: string;
  interactive?: boolean;
  // File arguments (unused in core, passed through to main)
  files?: string[];
  messages?: string[];
  mode?: 'interactive' | 'print' | 'json' | 'rpc';
}

/**
 * Main bootstrapping function.
 *
 * Creates services, resolves session, sets up runtime, configures model.
 */
export async function bootPiclaw(options: PiclawCoreOptions = {}): Promise<AgentSessionRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const agentDir = options.agentDir ?? getAgentDir();
  const contextLogFile = options.contextLogFile ?? getDefaultContextLogFile(cwd);
  const interactive = options.interactive ?? true;

  logger.debug("Bootstrapping Piclaw", { cwd, agentDir, interactive });

  // ============================================
  // 1. RESOLVE SESSION MANAGER
  // ============================================
  const sessionManager = await resolveSessionManager({
    cwd,
    sessionDir: options.sessionDir,
    session: options.session,
    resume: options.resume,
    continue: options.continue,
    fork: options.fork,
    interactive,
  });

  // ============================================
  // 2. CREATE RUNTIME FACTORY
  // ============================================
  const createRuntimeFactory: CreateAgentSessionRuntimeFactory = async (factoryOptions) => {
    const { cwd: factoryCwd, agentDir: factoryAgentDir, sessionManager, sessionStartEvent } = factoryOptions;
    const effectiveCwd = factoryCwd ?? process.cwd();
    const effectiveAgentDir = factoryAgentDir ?? getAgentDir();

    if (!effectiveCwd) {
      throw new Error('effectiveCwd is not set in runtime factory');
    }

    // Settings manager (persistent user/project settings)
    const settingsManager = SettingsManager.create(effectiveCwd, effectiveAgentDir);

    // Custom package manager for Piclaw extensions
    const packageManager = new PiclawPackageManager({ cwd: effectiveCwd, agentDir: effectiveAgentDir });

    // Ensure .pi/prompts directory exists for user prompt templates
    const promptsDir = join(effectiveCwd, '.pi', 'prompts');
    try {
      mkdirSync(promptsDir, { recursive: true });
    } catch (e) {
      // Non-fatal: continue if directory creation fails (maybe permission issue)
      logger.debug(`Failed to create prompts directory: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Create core services
    const services = await createAgentSessionServices({
      cwd: effectiveCwd,
      agentDir: effectiveAgentDir,
      settingsManager,
      resourceLoaderOptions: {
        packageManager,
        additionalPromptTemplatePaths: [promptsDir],
        ...getResourceLoaderOptions(),
      },
    });

    if (typeof services.cwd !== 'string') {
      throw new Error('services.cwd is not a string after creation');
    }

    // Create agent session from services + session manager
    const result = await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
      tools: options.tools,
    });

    return {
      ...result,
      services,
      diagnostics: services.diagnostics,
    };
  };

  // ============================================
  // 3. CREATE RUNTIME WITH RESOLVED SESSION
  // ============================================
  const runtime = await createAgentSessionRuntime(createRuntimeFactory, {
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent: { type: "session_start", reason: "startup" },
  });

  if (typeof runtime.cwd !== 'string') {
    throw new Error('runtime cwd missing after creation');
  }

  logger.debug("Runtime created", {
    sessionId: sessionManager.getSessionId(),
    cwd: runtime.cwd,
  });

  // ============================================
  // 4. CONTEXT LOGGING (optional)
  // ============================================
  if (contextLogFile && runtime.session?.agent?.streamFn) {
    const originalStreamFn = runtime.session.agent.streamFn;
    runtime.session.agent.streamFn = createContextLoggingStreamFn(
      originalStreamFn,
      contextLogFile
    ) as typeof originalStreamFn;
    logger.debug(`Context logging enabled: ${contextLogFile}`);
  }

  // Store parent runtime reference in session manager (for extensions)
  const sessionMgr = runtime.session.sessionManager as SessionManagerWithParent;
  if (sessionMgr) {
    sessionMgr.parentRuntime = runtime;
  }

  // ============================================
  // 5. SETUP MODEL SCOPING
  // ============================================
  // Determine if session already has a model (from persisted file)
  const sessionHasModel = !!runtime.session?.model;

  const scopingResult = await setupModelScoping({
    modelRegistry: runtime.services.modelRegistry,
    settingsManager: runtime.services.settingsManager,
    cliModel: options.model,
    cliThinking: options.thinking,
    currentSessionHasModel: sessionHasModel,
  });

  const { model: activeScopedModel, scopedModels } = scopingResult;

  // Set scoped models on session (for Ctrl+P cycling)
  // Type cast needed because our local ScopedModel matches package's ScopedModel interface
  runtime.session.setScopedModels(scopedModels as any);
  logger.debug(`Scoped models: ${scopedModels.length} models available for cycling`);

  // Set active model if needed (only when not already present in session)
  if (activeScopedModel && !sessionHasModel) {
    await runtime.session.setModel(activeScopedModel.model);
    logger.info(`Active model: ${activeScopedModel.model.provider}/${activeScopedModel.model.id}`);
  } else if (sessionHasModel) {
    logger.debug(`Session already has model: ${runtime.session.model?.provider}/${runtime.session.model?.id}`);
  }

  // ============================================
  // 6. APPLY THINKING LEVEL WITH PROPER PRECEDENCE
  // Precedence: 1) Scoped model pattern/CLI model suffix → 2) CLI flag → 3) Existing session value (keep)
  // ============================================
  const thinkingFromScoped = activeScopedModel?.thinkingLevel;
  const thinkingFromCli = options.thinking;
  // Note: runtime.session.thinkingLevel already contains the session's persisted value (if any)

  if (thinkingFromScoped) {
    runtime.session.setThinkingLevel(thinkingFromScoped);
    logger.debug(`Thinking level from scoped model: ${thinkingFromScoped}`);
  } else if (thinkingFromCli) {
    runtime.session.setThinkingLevel(thinkingFromCli);
    logger.debug(`Thinking level from CLI: ${thinkingFromCli}`);
  } else {
    // No explicit override; keep whatever the session already had (or default from package)
    logger.debug(`Thinking level unchanged (using session/default)`);
  }

  return runtime;
}

// Re-export team functionality (if needed)
export { bootPiclawTeam, executeTeamTasks, type AgentTeam } from "./extensions/team/team-manager.js";
