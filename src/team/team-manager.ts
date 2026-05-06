/**
 * AgentSession Team Manager
 * Simple shared-context team for parallel execution
 */
import {
  SessionManager,
  AgentSessionRuntime,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
} from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "../config/config.js";
import { createSubLoaderToolDefinition } from "../tools/subtool-loader.js";

export type TeamExecutionMode = "parallel" | "sequential";

export interface AgentTeamRuntime {
  runtimes: AgentSessionRuntime[];
  size: number;
  roles: string[];
  dispose: () => Promise<void>;
}

/**
 * Create team with shared context - simple approach
 */
export async function bootPiclawTeam(
  parentRuntime: AgentSessionRuntime,
  options: {
    teamSize?: number;
    teamRoles?: string[];
    tools?: string[];
  } = {}
): Promise<AgentTeamRuntime> {
  const cwd = parentRuntime.cwd;
  const agentDir = getAgentDir();
  const teamSize = options.teamSize ?? 2;
  const teamRoles = options.teamRoles ?? [];

  const runtimes: AgentSessionRuntime[] = [parentRuntime]; // Parent first

  for (let i = 0; i < teamSize; i++) {
    const factory: CreateAgentSessionRuntimeFactory = async ({
      cwd: sessionCwd,
      agentDir: sessionAgentDir,
      sessionManager,
      sessionStartEvent,
    }) => {
      const services = await createAgentSessionServices({
        cwd,
        agentDir: sessionAgentDir,
        authStorage: parentRuntime.services.authStorage,
        settingsManager: parentRuntime.services.settingsManager,
        modelRegistry: parentRuntime.services.modelRegistry,
      });

      const sessionResult = await createAgentSessionFromServices({
        services,
        sessionManager, // Shared session for coordination
        sessionStartEvent,
        tools: options.tools,
        customTools: [createSubLoaderToolDefinition(cwd)],
      });

      return {
        session: sessionResult.session,
        services,
        diagnostics: services.diagnostics,
      } as CreateAgentSessionRuntimeResult;
    };

    const runtime = await createAgentSessionRuntime(factory, {
      cwd,
      agentDir,
      sessionManager: parentRuntime.session.sessionManager,
      sessionStartEvent: {
        type: "session_start",
        reason: "team_child",
        agentIndex: i + 1,
        role: teamRoles[i],
      } as any,
    });

    runtimes.push(runtime);
  }

  return {
    runtimes,
    size: runtimes.length,
    roles: ["parent", ...teamRoles],
    async dispose() {
      await Promise.all(runtimes.slice(1).map(rt => rt.dispose()));
    },
  };
}

export async function executeTeamTasks(
  team: AgentTeamRuntime,
  tasks: string[],
  mode: TeamExecutionMode = "parallel"
): Promise<string[]> {
  function getMessageText(message: any): string {
    if (!message) return "";
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    }
    return "";
  }

  if (mode === "parallel") {
    const results = await Promise.all(
      tasks.map(async (task, index) => {
        const agentIndex = (index % (team.runtimes.length - 1)) + 1;
        const runtime = team.runtimes[agentIndex];
        if (runtime.session) {
          await runtime.session.prompt(task);
          const msg = runtime.session.messages[runtime.session.messages.length - 1];
          return getMessageText(msg);
        }
        return `Agent ${agentIndex}: ${task}`;
      })
    );
    return results;
  }

  const results: string[] = [];
  for (const task of tasks) {
    const runtime = team.runtimes[0];
    if (runtime.session) {
      await runtime.session.prompt(task);
      const msg = runtime.session.messages[runtime.session.messages.length - 1];
      results.push(getMessageText(msg));
    } else {
      results.push(task);
    }
  }
  return results;
}