#!/usr/bin/env node

/**
 * Git Tool
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createBashTool, createLocalBashOperations, type BashToolInput } from "@earendil-works/pi-coding-agent";
import { Text, type Component } from "@earendil-works/pi-tui";
import { renderDiff } from "@earendil-works/pi-coding-agent";

interface GitParams {
  action: "diff" | "log" | "status" | "commit" | "branch" | "checkout" | "add" | "push" | "pull";
  args?: {
    revision?: string;
    count?: number;
    message?: string;
    action?: "list" | "create" | "delete";
    branch?: string;
    files?: string[];
    remote?: string;
  };
}

/** Escape a string for safe inclusion in a shell command (single-quote style). */
export function escapeShellArg(arg: string): string {
  if (arg === undefined) return '';
  // Replace any single quote with the close-open-escape-close pattern
  const escaped = arg.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

function createGitTool(cwd: string): ToolDefinition<any, any> {
  const bashOperations = createLocalBashOperations();
  const baseBashTool: any = createBashTool(cwd, { operations: bashOperations });

  return {
    name: "git",
    label: "Git",
    description: "Git version control: diff, log, status, commit, branch, checkout, add, push, pull.",
    promptSnippet: "git({ action: 'diff|log|status|commit|branch|checkout|add|push|pull', args?: {...} })",
    promptGuidelines: [
      "action: git operation",
      "diff: show changes (args.revision?) default HEAD",
      "log: history (args.count?) default 10",
      "status: working tree status",
      "commit: args.message required",
      "branch: args.action 'list'|'create'|'delete', branch for create/delete",
      "checkout: args.branch required",
      "add: args.files[] required",
      "push: args.remote?, args.branch?",
      "pull: args.remote?, args.branch?",
    ],
    parameters: {},

    async execute(
      toolCallId: string,
      params: GitParams,
      signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: any
    ) {
      const { action, args = {} } = params;

      let command = "";
      try {
        switch (action) {
          case "diff":
            command = `git diff ${args.revision ? escapeShellArg(args.revision) : 'HEAD'}`;
            break;
          case "log":
            command = `git log -${args.count || 10} --oneline --graph --decorate`;
            break;
          case "status":
            command = "git status";
            break;
          case "commit":
            if (!args.message) throw new Error("commit requires 'message'");
            command = `git commit -m ${escapeShellArg(args.message)}`;
            break;
          case "branch":
            const branchAction = args.action || "list";
            if (branchAction === "list") command = "git branch -a";
            else if (branchAction === "create") {
              if (!args.branch) throw new Error("branch create requires 'branch'");
              command = `git branch ${escapeShellArg(args.branch)}`;
            } else if (branchAction === "delete") {
              if (!args.branch) throw new Error("branch delete requires 'branch'");
              command = `git branch -d ${escapeShellArg(args.branch)}`;
            } else throw new Error(`unknown branch action: ${branchAction}`);
            break;
          case "checkout":
            if (!args.branch) throw new Error("checkout requires 'branch'");
            command = `git checkout ${escapeShellArg(args.branch)}`;
            break;
          case "add":
            if (!args.files?.length) throw new Error("add requires 'files' array");
            command = `git add ${args.files.map(escapeShellArg).join(' ')}`;
            break;
          case "push":
            command = `git push ${escapeShellArg(args.remote || 'origin')}${args.branch ? ' ' + escapeShellArg(args.branch) : ''}`;
            break;
          case "pull":
            command = `git pull ${escapeShellArg(args.remote || 'origin')}${args.branch ? ' ' + escapeShellArg(args.branch) : ''}`;
            break;
          default:
            throw new Error(`unknown git action: ${action}`);
        }

        const bashInput: BashToolInput = { command };
        const result = await baseBashTool.execute(toolCallId, bashInput, signal, undefined, ctx);
        const resultAny = result as any;
        const outputMsg = resultAny.content?.find((c: any) => c.type === "text")?.text || "";
        const isError = resultAny.isError || false;

        let renderedText = outputMsg;
        if (action === "diff" && !isError && outputMsg) {
          try {
            // TODO: Use renderDiff after fixing import signature
            // renderedText = renderDiff(outputMsg);
            renderedText = outputMsg; // plain for now
          } catch {
            renderedText = outputMsg;
          }
        }

        return {
          content: [{ type: "text", text: renderedText }],
          details: { command, output: outputMsg },
          isError
        };
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ Git error: ${errorMsg}` }],
          details: { command: command || "", output: "", error: errorMsg },
          isError: true
        };
      }
    },

    renderCall: (args: unknown, theme: any) => {
      const p = args as GitParams;
      return new Text(`${theme.fg("toolTitle", theme.bold("git"))} ${theme.fg("muted", p.action)}`);
    },

    renderResult: (result: any, _options: any, theme: any): Component => {
      const details = result.details;
      if (!details) {
        return new Text(theme.fg("error", "No result"), 0, 0);
      }
      if (result.isError) {
        return new Text(theme.fg("error", `❌ Git error: ${details.error || details.output}`), 0, 0);
      }
      return new Text(details.output || "", 0, 0);
    },
  };
}

export function registerGitTool(api: ExtensionAPI): void {
  api.on("session_start", async (_event, ctx) => {
    const tool = createGitTool(ctx.cwd);
    api.registerTool(tool);
  });
}
