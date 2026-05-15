import { Type } from "typebox";

export const bzrSchema = Type.Object({
  command: Type.Optional(Type.String()),
  operation: Type.Optional(Type.String()),
  target: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
  revision: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
  author: Type.Optional(Type.String()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeBzr(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, target, url, revision, message, author, verbose, version } = args;
  const timeout = 60000;
  try {
    if (version) {
      const result = await ctx!.exec("bzr", ["--version"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const bzrArgs: string[] = [];
    if (verbose) bzrArgs.push("-v");

    const op = operation || "status";

    if (op === "branch") {
      bzrArgs.push("branch");
      if (revision) bzrArgs.push("-r", revision);
      bzrArgs.push(url || "REPO_URL");
      bzrArgs.push(target || ".");
    } else if (op === "pull") {
      bzrArgs.push("pull");
      if (url) bzrArgs.push(url);
      if (revision) bzrArgs.push("-r", revision);
    } else if (op === "push") {
      bzrArgs.push("push");
      if (url) bzrArgs.push(url);
      if (revision) bzrArgs.push("-r", revision);
    } else if (op === "commit" || op === "ci") {
      bzrArgs.push("commit");
      if (message) bzrArgs.push("-m", message);
      if (author) bzrArgs.push("--author", author);
      if (target) bzrArgs.push(target);
    } else if (op === "status" || op === "st") {
      bzrArgs.push("status");
      if (target) bzrArgs.push(target);
    } else if (op === "diff") {
      bzrArgs.push("diff");
      if (revision) bzrArgs.push("-r", revision);
      if (target) bzrArgs.push(target);
    } else if (op === "log") {
      bzrArgs.push("log");
      if (revision) bzrArgs.push("-r", revision);
      if (target) bzrArgs.push(target);
    } else if (op === "add") {
      bzrArgs.push("add");
      if (target) bzrArgs.push(target);
    } else if (op === "remove" || op === "rm") {
      bzrArgs.push("remove");
      if (target) bzrArgs.push(target);
    } else if (op === "merge") {
      bzrArgs.push("merge");
      if (url) bzrArgs.push(url);
      if (revision) bzrArgs.push("-r", revision);
    } else if (op === "update" || op === "up") {
      bzrArgs.push("update");
      if (revision) bzrArgs.push("-r", revision);
    } else if (op === "revert") {
      bzrArgs.push("revert");
      if (revision) bzrArgs.push("-r", revision);
      if (target) bzrArgs.push(target);
    } else if (op === "info") {
      bzrArgs.push("info");
      if (target) bzrArgs.push(target);
    } else if (op === "whoami") {
      bzrArgs.push("whoami");
      if (author) bzrArgs.push(author);
    } else if (op === "init") {
      bzrArgs.push("init");
      if (target) bzrArgs.push(target);
    } else if (op === "checkout" || op === "co") {
      bzrArgs.push("checkout");
      if (revision) bzrArgs.push("-r", revision);
      if (url) bzrArgs.push(url);
      if (target) bzrArgs.push(target);
    } else {
      bzrArgs.push(op);
      if (target) bzrArgs.push(target);
    }

    const result = await ctx!.exec("bzr", bzrArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
