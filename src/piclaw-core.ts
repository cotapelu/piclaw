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

  const createRuntimeFactory: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent,
  }) => {
    // Custom storage using .piclaw
    const storage = {
      withLock(scope: "global" | "project", fn: (current: string | undefined) => string | undefined): void {
        const path = scope === "global"
          ? join(agentDir, "settings.json")
          : join(cwd, ".piclaw", "settings.json");
        const dir = dirname(path);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const current = existsSync(path) ? readFileSync(path, "utf-8") : undefined;
        const next = fn(current);
        if (next !== undefined) writeFileSync(path, next, "utf-8");
      },
    } as any;

    const SettingsManagerCtor = SettingsManager as any;
    const settingsManager = new SettingsManagerCtor(storage, cwd, agentDir);

    // Custom package manager
    const packageManager = new PiclawPackageManager({ cwd, agentDir });

    const newServices = await createAgentSessionServices({
      cwd,
      agentDir,
      settingsManager,
      resourceLoaderOptions: { packageManager } as any,
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

  const sessionManager = SessionManager.create(cwd, options.sessionDir);
  const runtime = await createAgentSessionRuntime(createRuntimeFactory, {
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent: { type: "session_start", reason: "startup" },
  });

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
          console.warn(`Model '${options.model}' not found in registry.`);
        }
      } else {
        console.warn(`Invalid model format: '${options.model}'. Use provider:modelId`);
      }
    } catch (err: any) {
      console.warn(`Failed to set model '${options.model}': ${err.message}`);
    }
  }

  if (options.thinking && runtime.session) {
    runtime.session.setThinkingLevel(options.thinking);
  }

  return runtime;
}

export { bootPiclawTeam, executeTeamTasks, type AgentTeam } from "./extensions/team/team-manager.js";
