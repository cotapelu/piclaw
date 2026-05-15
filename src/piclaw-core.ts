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
  createAgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
  type AgentSessionServices,
  type AgentSessionRuntimeDiagnostic,
} from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "./config/config.js";
import { getDefaultContextLogFile } from "./config/config-manager.js";

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
 * - Session creation using factory system
 * - Initial model and thinking level configuration
 *
 * @param options - Configuration options
 * @returns AgentSessionRuntime ready to run
 */
export async function bootPiclaw(options: PiclawCoreOptions = {}): Promise<AgentSessionRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const agentDir = options.agentDir ?? getAgentDir();

  // Context log file if logging is enabled
  const contextLogFile = options.contextLogFile ?? getDefaultContextLogFile(cwd);

  // Create factory for session switching
  const createRuntimeFactory: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent,
  }) => {
    const newServices = await createAgentSessionServices({
      cwd,
      agentDir,
    });

    const result = await createAgentSessionFromServices({
      services: newServices,
      sessionManager,
      sessionStartEvent,
      tools: options.tools,
    });

    return {
      ...result,
      services: newServices,
      diagnostics: newServices.diagnostics,
    };
  };

  // Create initial session manager
  const sessionManager = SessionManager.create(cwd, options.sessionDir);

  // Create runtime using factory system
  const runtime = await createAgentSessionRuntime(createRuntimeFactory, {
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent: { type: "session_start", reason: "startup" },
  });

  // Wrap streamFn with context logging if enabled
  if (contextLogFile && runtime.session?.agent?.streamFn) {
    const originalStreamFn = runtime.session.agent.streamFn;
    runtime.session.agent.streamFn = createContextLoggingStreamFn(originalStreamFn, contextLogFile) as any;
  }

  // Expose the parent runtime via sessionManager for team operations
  // This allows the spawn_team tool to access the parent runtime via ctx.sessionManager.parentRuntime
  (runtime.session.sessionManager as any).parentRuntime = runtime;

  // Also expose on extension runner's runtime object for backward compatibility
  const extensionRunner = runtime.session.extensionRunner as any;
  if (extensionRunner.runtime) {
    extensionRunner.runtime.sessionRuntime = runtime;
  }

  // Apply initial model if configured
  if (options.model && runtime.session?.model) {
    try {
      const [provider, modelId] = options.model.split(":");
      if (provider && modelId) {
        const model = runtime.services.modelRegistry.find(provider, modelId);
        if (model) {
          await runtime.session.setModel(model);
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

  // Apply initial thinking level if configured
  if (options.thinking && runtime.session) {
    runtime.session.setThinkingLevel(options.thinking);
  }

  return runtime;
}

// Team functions are in src/team/team-manager.ts
export { bootPiclawTeam, executeTeamTasks, type AgentTeam } from "./team/team-manager.js";