import { Type } from "typebox";

export const darcsSchema = Type.Object({
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

export async function executeDarcs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, target, url, revision, message, author, verbose, version } = args;
  const timeout = 60000;
  try {
    if (version) {
      const result = await ctx!.exec("darcs", ["--version"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const darcsArgs: string[] = [];
    if (verbose) darcsArgs.push("-v");

    const op = operation || "status";

    if (op === "clone" || op === "get") {
      darcsArgs.push("get");
      if (revision) darcsArgs.push("-t", revision);
      darcsArgs.push(url || "REPO_URL");
      darcsArgs.push(target || ".");
    } else if (op === "pull") {
      darcsArgs.push("pull");
      if (url) darcsArgs.push(url);
      if (revision) darcsArgs.push("-t", revision);
    } else if (op === "push") {
      darcsArgs.push("push");
      if (url) darcsArgs.push(url);
      if (revision) darcsArgs.push("-t", revision);
    } else if (op === "apply") {
      darcsArgs.push("apply");
      if (url) darcsArgs.push(url);
      if (revision) darcsArgs.push("-t", revision);
    } else if (op === "record" || op === "commit" || op === "ci") {
      darcsArgs.push("record");
      if (message) darcsArgs.push("-m", message);
      if (author) darcsArgs.push("--author", author);
      darcsArgs.push(target || ".");
    } else if (op === "amend") {
      darcsArgs.push("amend");
      if (message) darcsArgs.push("-m", message);
      if (author) darcsArgs.push("--author", author);
    } else if (op === "status" || op === "st") {
      darcsArgs.push("status");
      darcsArgs.push(target || ".");
    } else if (op === "diff") {
      darcsArgs.push("diff");
      if (revision) darcsArgs.push("-t", revision);
      darcsArgs.push(target || ".");
    } else if (op === "log") {
      darcsArgs.push("log");
      if (revision) darcsArgs.push("-t", revision);
      darcsArgs.push(target || ".");
    } else if (op === "add") {
      darcsArgs.push("add");
      darcsArgs.push(target || ".");
    } else if (op === "remove" || op === "rm") {
      darcsArgs.push("remove");
      darcsArgs.push(target || ".");
    } else if (op === "tag") {
      darcsArgs.push("tag");
      if (revision) darcsArgs.push(revision);
    } else if (op === "optimize") {
      darcsArgs.push("optimize");
    } else if (op === "what") {
      darcsArgs.push("whatsnew");
      darcsArgs.push(target || ".");
    } else {
      darcsArgs.push(op);
      if (target) darcsArgs.push(target);
    }

    const result = await ctx!.exec("darcs", darcsArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
