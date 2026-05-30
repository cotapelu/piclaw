#!/usr/bin/env node

/**
 * Piclaw Core Bootstrapping
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
import { getAgentDir } from "./config/config-manager.js";
import { getDefaultContextLogFile } from "./config/config-manager.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "node:path";
import { PiclawPackageManager } from "./piclaw-package-manager.js";
import { createContextLoggingStreamFn } from "./utils/context-logger.js";
import { logger } from "./utils/logger.js";

export interface PiclawCoreOptions {
  cwd?: string;
  agentDir?: string;
  sessionDir?: string;
  tools?: string[];
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  verbose?: boolean;
  contextLogFile?: string;
}

export async function bootPiclaw(options: PiclawCoreOptions = {}): Promise<AgentSessionRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const agentDir = options.agentDir ?? getAgentDir();
  const contextLogFile = options.contextLogFile ?? getDefaultContextLogFile(cwd);

  const createRuntimeFactory: CreateAgentSessionRuntimeFactory = async (factoryOptions) => {
    const { cwd, agentDir, sessionManager, sessionStartEvent } = factoryOptions as any;
    // Fallback in case these are undefined
    const effectiveCwd = cwd ?? process.cwd();
    const effectiveAgentDir = agentDir ?? getAgentDir();
    if (!effectiveCwd) throw new Error('effectiveCwd is not set');
    // Use default SettingsManager (will use .pi storage)
    const settingsManager = SettingsManager.create(effectiveCwd, effectiveAgentDir);

    // Custom package manager
    const packageManager = new PiclawPackageManager({ cwd: effectiveCwd, agentDir: effectiveAgentDir });

    const newServices = await createAgentSessionServices({
      cwd: effectiveCwd,
      agentDir: effectiveAgentDir,
      settingsManager,
      resourceLoaderOptions: { packageManager } as any,
    });
    if (typeof newServices.cwd !== 'string') {
      throw new Error('newServices.cwd is not a string: ' + JSON.stringify({ cwd: newServices.cwd, services: newServices }));
    }

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

  const sessionManager = SessionManager.create(cwd, options.sessionDir);
  const runtime = await createAgentSessionRuntime(createRuntimeFactory, {
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent: { type: "session_start", reason: "startup" },
  });
  if (typeof runtime.cwd !== 'string') {
    throw new Error('runtime cwd missing after creation');
  }

  if (contextLogFile && runtime.session?.agent?.streamFn) {
    const originalStreamFn = runtime.session.agent.streamFn;
    runtime.session.agent.streamFn = createContextLoggingStreamFn(originalStreamFn, contextLogFile) as any;
  }

  (runtime.session.sessionManager as any).parentRuntime = runtime;
  const extensionRunner = runtime.session.extensionRunner as any;
  if (extensionRunner.runtime) {
    extensionRunner.runtime.sessionRuntime = runtime;
  }

  if (options.model && runtime.session?.model) {
    try {
      const [provider, modelId] = options.model.split(":");
      if (provider && modelId) {
        const model = runtime.services.modelRegistry.find(provider, modelId);
        if (model) {
          await runtime.session.setModel(model);
        } else {
          logger.warn(`Model '${options.model}' not found in registry.`);
        }
      } else {
        logger.warn(`Invalid model format: '${options.model}'. Use provider:modelId`);
      }
    } catch (err: any) {
      logger.warn(`Failed to set model '${options.model}': ${err.message}`);
    }
  }

  if (options.thinking && runtime.session) {
    runtime.session.setThinkingLevel(options.thinking);
  }

  return runtime;
}

export { bootPiclawTeam, executeTeamTasks, type AgentTeam } from "./extensions/team/team-manager.js";
