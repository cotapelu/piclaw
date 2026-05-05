#!/usr/bin/env node

/**
 * Piclaw Core Bootstrapping
 *
 * Core logic for creating and configuring the agent runtime.
 * Separated from UI concerns for testability and reusability.
 */

import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
  AgentSessionRuntime,
  type CreateAgentSessionRuntimeResult,
  type AgentSessionServices,
  type SessionStartEvent,
} from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "./config/config.js";
import { getDefaultContextLogFile } from "./config/config-manager.js";
import { createSubLoaderToolDefinition } from "./tools/subtool-loader.js";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { createContextLoggingStreamFn } from "./context-logger.js";

export interface PiclawCoreOptions {
  /** Working directory (default: process.cwd()) */
  cwd?: string;
  /** Agent directory (default: ~/.piclaw/agent) */
  agentDir?: string;
  /** Custom session directory */
  sessionDir?: string;
  /** Tool allowlist (default: from settings or built-in) */
  tools?: string[];
  /** Additional custom tools to register */
  customTools?: ToolDefinition[];
  /** Model to use (provider:modelId) */
  model?: string;
  /** Thinking level */
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  /** Verbose logging */
  verbose?: boolean;
  /** Path to file where LLM context (system prompt, messages, tools) will be logged before each request */
  contextLogFile?: string;
}

/**
 * Create the agent runtime without starting the UI.
 *
 * This function handles:
 * - Services creation (auth, models, settings, resource loader)
 * - Session creation
 * - Runtime factory for session switching
 * - Initial model and thinking level configuration
 *
 * @param options - Configuration options
 * @returns AgentSessionRuntime ready to run
 */
export async function bootPiclaw(options: PiclawCoreOptions = {}): Promise<AgentSessionRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const agentDir = options.agentDir ?? getAgentDir();
  // Default context log file if not specified
  const contextLogFile = options.contextLogFile ?? getDefaultContextLogFile(cwd);

  // 1. Create cwd-bound services
  const services: AgentSessionServices = await createAgentSessionServices({
    cwd,
    agentDir,
  });

  // 2. Create session manager
  const sessionManager = SessionManager.create(cwd, options.sessionDir);

  // 3. Create session from services
  const sessionStartEvent: SessionStartEvent = { type: "session_start", reason: "startup" };

  // Prepare custom tools (ensure subtool_loader is included)
  const customTools = options.customTools ?? [createSubLoaderToolDefinition(services.cwd)];

  const sessionResult = await createAgentSessionFromServices({
    services,
    sessionManager,
    sessionStartEvent,
    tools: options.tools,
    customTools,
  });

  // 4. Create runtime factory (for session switching)
  const createRuntime = async (runtimeOpts: {
    cwd: string;
    agentDir: string;
    sessionManager: SessionManager;
    sessionStartEvent?: SessionStartEvent;
  }): Promise<CreateAgentSessionRuntimeResult> => {
    const newServices = await createAgentSessionServices({
      cwd: runtimeOpts.cwd,
      agentDir: runtimeOpts.agentDir,
    });

    const customToolsForRuntime = options.customTools ?? [createSubLoaderToolDefinition(newServices.cwd)];
    const result = await createAgentSessionFromServices({
      services: newServices,
      sessionManager: runtimeOpts.sessionManager,
      sessionStartEvent: runtimeOpts.sessionStartEvent,
      tools: options.tools,
      customTools: customToolsForRuntime,
    });

    return {
      ...result,
      services: newServices,
      diagnostics: [],
    };
  };

  // 5. Wrap streamFn with context logging if enabled
  if (contextLogFile) {
    const originalStreamFn = sessionResult.session.agent.streamFn;
    sessionResult.session.agent.streamFn = createContextLoggingStreamFn(originalStreamFn, contextLogFile) as any;
  }

  // 6. Create runtime
  const runtime = new AgentSessionRuntime(
    sessionResult.session,
    services,
    createRuntime,
    [], // diagnostics
    sessionResult.modelFallbackMessage,
  );

  // 6. Apply initial model if configured
  if (options.model) {
    try {
      const [provider, modelId] = options.model.split(":");
      if (provider && modelId) {
        const model = services.modelRegistry.find(provider, modelId);
        if (model) {
          await sessionResult.session.setModel(model);
        } else {
          console.warn(`Model '${options.model}' not found in registry.`);
        }
      } else {
        console.warn(`Invalid model format: '${options.model}'. Use provider:modelId`);
      }
    } catch (err: any) {
      console.warn(`Failed to set model '${options.model}': ${err.message}`);
    }
  }

  // 7. Apply initial thinking level if configured
  if (options.thinking) {
    sessionResult.session.setThinkingLevel(options.thinking);
  }

  return runtime;
}
