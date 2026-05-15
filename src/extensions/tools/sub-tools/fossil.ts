import { Type } from "typebox";

export const fossilSchema = Type.Object({
  command: Type.Optional(Type.String()),
  operation: Type.Optional(Type.String()),
  target: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
  revision: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
  branch: Type.Optional(Type.String()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeFossil(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, target, url, revision, message, branch, verbose, version } = args;
  const timeout = 60000;
  try {
    if (version) {
      const result = await ctx!.exec("fossil", ["--version"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const fossilArgs: string[] = [];
    if (verbose) fossilArgs.push("-v");

    const op = operation || "status";

    if (op === "clone") {
      fossilArgs.push("clone", url || "REPO_URL", target || "repo.fossil");
    } else if (op === "open") {
      fossilArgs.push("open");
      if (revision) fossilArgs.push("-r", revision);
      if (branch) fossilArgs.push("--branch", branch);
      fossilArgs.push(target || "repo.fossil");
    } else if (op === "pull") {
      fossilArgs.push("pull");
      if (url) fossilArgs.push(url);
      if (revision) fossilArgs.push("-r", revision);
    } else if (op === "push") {
      fossilArgs.push("push");
      if (url) fossilArgs.push(url);
      if (revision) fossilArgs.push("-r", revision);
    } else if (op === "commit" || op === "ci") {
      fossilArgs.push("commit");
      if (message) fossilArgs.push("-m", message);
      if (branch) fossilArgs.push("--branch", branch);
    } else if (op === "status" || op === "st") {
      fossilArgs.push("status");
    } else if (op === "diff") {
      fossilArgs.push("diff");
      if (revision) fossilArgs.push("-r", revision);
      if (target) fossilArgs.push(target);
    } else if (op === "log") {
      fossilArgs.push("log");
      if (revision) fossilArgs.push("-r", revision);
      if (branch) fossilArgs.push("-b");
      if (target) fossilArgs.push(target);
    } else if (op === "add") {
      fossilArgs.push("add");
      if (target) fossilArgs.push(target);
    } else if (op === "rm" || op === "remove" || op === "delete") {
      fossilArgs.push("rm");
      if (target) fossilArgs.push(target);
    } else if (op === "undo") {
      fossilArgs.push("undo");
    } else if (op === "timeline") {
      fossilArgs.push("timeline");
      if (branch) fossilArgs.push("-b", branch);
    } else if (op === "branch") {
      fossilArgs.push("branch");
      if (branch) fossilArgs.push(branch);
    } else if (op === "tag") {
      fossilArgs.push("tag", "add", revision || "");
    } else if (op === "merge") {
      fossilArgs.push("merge");
      if (revision) fossilArgs.push(revision);
    } else if (op === "update" || op === "up") {
      fossilArgs.push("update");
      if (revision) fossilArgs.push(revision);
    } else if (op === "checkout" || op === "co") {
      fossilArgs.push("checkout");
      if (revision) fossilArgs.push(revision);
    } else if (op === "ui" || op === "server") {
      fossilArgs.push("ui");
      if (url) fossilArgs.push(url);
    } else if (op === "info") {
      fossilArgs.push("info");
      if (target) fossilArgs.push(target);
    } else {
      fossilArgs.push(op);
      if (target) fossilArgs.push(target);
    }

    const result = await ctx!.exec("fossil", fossilArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
