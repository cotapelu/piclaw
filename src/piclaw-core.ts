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
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "./config/config.js";
import { getDefaultContextLogFile } from "./config/config-manager.js";
import { createSubLoaderToolDefinition } from "./tools/subtool-loader.js";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { createContextLoggingStreamFn } from "./context-logger.js";
import { join } from "node:path";

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
  /** Number of agents in team mode (default: 1) - Used when LLM decides to spawn multiple agents */
  teamSize?: number;
  /** Team agent roles/names for identification */
  teamRoles?: string[];
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

    const customTools = options.customTools ?? [createSubLoaderToolDefinition(cwd)];
    
    const result = await createAgentSessionFromServices({
      services: newServices,
      sessionManager,
      sessionStartEvent,
      tools: options.tools,
      customTools,
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

// ============================================================================
// AgentSession Team - Enhanced Hybrid Architecture
// ============================================================================

/**
 * Result from bootPiclawTeam - represents a team of agents
 */
export interface AgentTeamRuntime {
  /** Array of AgentSessionRuntimes - each agent in the team */
  runtimes: AgentSessionRuntime[];
  /** Team metadata */
  size: number;
  roles: string[];
  /** Dispose all agents in the team */
  dispose: () => Promise<void>;
}

/**
 * Create multiple agents (team) that work on the same project.
 * 
 * Enhanced Hybrid Architecture:
 * - SHARED: AuthStorage, ModelRegistry, SettingsManager (read-only during runtime)
 * - PER-AGENT: ResourceLoader, SessionManager, AgentSession (full state isolation)
 * 
 * This allows LLM to decide dynamically when to spawn additional agents
 * for parallel task execution.
 */
export async function bootPiclawTeam(
  options: PiclawCoreOptions & { teamSize?: number; teamRoles?: string[] } = {}
): Promise<AgentTeamRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const agentDir = options.agentDir ?? getAgentDir();
  const teamSize = options.teamSize ?? 3;
  const teamRoles = options.teamRoles ?? [];

  // 1. CREATE SHARED SERVICES (thread-safe, read-mostly)
  const sharedAuthStorage = AuthStorage.create(join(agentDir, "auth.json"));
  const sharedModelRegistry = ModelRegistry.create(
    sharedAuthStorage,
    join(agentDir, "models.json")
  );
  const sharedSettingsManager = SettingsManager.create(cwd, agentDir);

  // 2. CREATE FACTORY FUNCTION for per-agent runtime creation
  const createRuntimeFactory: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent,
  }) => {
    // Each agent gets its own ResourceLoader for extension context
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager: sharedSettingsManager,
    });
    await resourceLoader.reload();

    const customTools = options.customTools ?? [createSubLoaderToolDefinition(cwd)];

    const result = await createAgentSessionFromServices({
      services: {
        cwd,
        agentDir,
        authStorage: sharedAuthStorage, // SHARED
        modelRegistry: sharedModelRegistry, // SHARED
        settingsManager: sharedSettingsManager, // SHARED
        resourceLoader, // PER-AGENT
        diagnostics: [],
      },
      sessionManager, // PER-AGENT (inMemory for isolation)
      sessionStartEvent,
      tools: options.tools,
      customTools,
    });

    return {
      ...result,
      services: {
        cwd,
        agentDir,
        authStorage: sharedAuthStorage,
        modelRegistry: sharedModelRegistry,
        settingsManager: sharedSettingsManager,
        resourceLoader,
        diagnostics: [],
      },
      diagnostics: [],
    };
  };

  // 3. CREATE MULTIPLE RUNTIMES
  const runtimes: AgentSessionRuntime[] = [];

  for (let i = 0; i < teamSize; i++) {
    const runtime = await createAgentSessionRuntime(createRuntimeFactory, {
      cwd,
      agentDir,
      sessionManager: SessionManager.inMemory(cwd),
      sessionStartEvent: {
        type: "session_start",
        reason: "team",
        agentIndex: i,
        role: teamRoles[i],
      } as any,
    });

    // Apply initial model if configured
    if (options.model && runtime.session?.model) {
      try {
        const [provider, modelId] = options.model.split(":");
        if (provider && modelId) {
          const model = runtime.services.modelRegistry.find(provider, modelId);
          if (model) {
            await runtime.session.setModel(model);
          }
        }
      } catch (err: any) {
        console.warn(`Failed to set model for agent ${i}: ${err.message}`);
      }
    }

    // Apply initial thinking level if configured
    if (options.thinking && runtime.session) {
      runtime.session.setThinkingLevel(options.thinking);
    }

    runtimes.push(runtime);
  }

  // 4. RETURN TEAM RUNTIME
  return {
    runtimes,
    size: runtimes.length,
    roles: teamRoles,
    async dispose() {
      await Promise.all(runtimes.map(rt => rt.dispose()));
    },
  };
}

// ============================================================================
// Team Management Utilities (for LLM to use)
// ============================================================================

/**
 * Team execution modes - LLM can choose how to run tasks
 */
export type TeamExecutionMode = "parallel" | "sequential" | "collaborative";

/**
 * Execute tasks across team agents
 */
export async function executeTeamTasks(
  team: AgentTeamRuntime,
  tasks: string[],
  mode: TeamExecutionMode = "parallel"
): Promise<string[]> {
  const results: string[] = [];

  // Helper to extract text from message
  function getMessageText(message: any): string {
    if (!message) return "";
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");
    }
    return "";
  }

  if (mode === "parallel") {
    // Distribute tasks to available agents
    const taskPromises = tasks.map(async (task, index) => {
      const agentIndex = index % team.runtimes.length;
      const runtime = team.runtimes[agentIndex];
      await runtime.session.prompt(task);
      const lastMessage = runtime.session.messages[runtime.session.messages.length - 1];
      return getMessageText(lastMessage);
    });
    results.push(...await Promise.all(taskPromises));
  } else if (mode === "sequential") {
    // Run tasks one after another
    for (const task of tasks) {
      const runtime = team.runtimes[0]; // Use first agent
      await runtime.session.prompt(task);
      const lastMessage = runtime.session.messages[runtime.session.messages.length - 1];
      results.push(getMessageText(lastMessage));
    }
  } else {
    // Collaborative: each agent contributes to the solution
    const collaborativeTasks = tasks.map((task) => 
      `${task}\n\nOther agents' perspectives have been received. Please provide your unique angle.`
    );
    const taskPromises = collaborativeTasks.map(async (task, index) => {
      const agentIndex = index % team.runtimes.length;
      const runtime = team.runtimes[agentIndex];
      await runtime.session.prompt(task);
      const lastMessage = runtime.session.messages[runtime.session.messages.length - 1];
      return getMessageText(lastMessage);
    });
    results.push(...await Promise.all(taskPromises));
  }

  return results;
}
