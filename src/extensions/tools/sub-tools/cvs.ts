import { Type } from "typebox";

export const cvsSchema = Type.Object({
  command: Type.Optional(Type.String()),
  operation: Type.Optional(Type.String()),
  target: Type.Optional(Type.String()),
  module: Type.Optional(Type.String()),
  revision: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
  repository: Type.Optional(Type.String()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeCvs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, target, module, revision, message, repository, verbose, version } = args;
  const timeout = 60000;
  try {
    if (version) {
      const result = await ctx!.exec("cvs", ["--version"], { cwd, signal, timeout });
      return (result.stdout || result.stderr).split('\n').slice(0,5).join('\n');
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const cvsArgs: string[] = [];
    if (verbose) cvsArgs.push("-v");

    const op = operation || "status";

    if (op === "checkout" || op === "co") {
      cvsArgs.push("checkout");
      if (revision) cvsArgs.push("-r", revision);
      cvsArgs.push(module || "MODULENAME");
      if (target) cvsArgs.push(target);
    } else if (op === "update" || op === "up") {
      cvsArgs.push("update");
      if (revision) cvsArgs.push("-r", revision);
      if (target) cvsArgs.push(target);
      else cvsArgs.push(".");
    } else if (op === "commit" || op === "ci") {
      cvsArgs.push("commit");
      if (message) cvsArgs.push("-m", message);
      if (target) cvsArgs.push(target);
      else cvsArgs.push(".");
    } else if (op === "status") {
      cvsArgs.push("status");
      if (target) cvsArgs.push(target);
      else cvsArgs.push(".");
    } else if (op === "diff") {
      cvsArgs.push("diff");
      if (revision) cvsArgs.push("-r", revision);
      if (target) cvsArgs.push(target);
      else cvsArgs.push(".");
    } else if (op === "log") {
      cvsArgs.push("log");
      if (revision) cvsArgs.push("-r", revision);
      if (target) cvsArgs.push(target);
      else cvsArgs.push(".");
    } else if (op === "add") {
      cvsArgs.push("add");
      if (target) cvsArgs.push(target);
    } else if (op === "remove" || op === "rm" || op === "delete") {
      cvsArgs.push("remove");
      if (target) cvsArgs.push(target);
    } else if (op === "tag") {
      cvsArgs.push("tag");
      if (revision) cvsArgs.push("-r", revision);
      if (target) cvsArgs.push(target);
      else cvsArgs.push("TAGNAME");
    } else if (op === "rtag") {
      cvsArgs.push("rtag");
      if (revision) cvsArgs.push("-r", revision);
      if (module) cvsArgs.push(module);
      else cvsArgs.push("TAGNAME");
    } else if (op === "import") {
      cvsArgs.push("import");
      if (message) cvsArgs.push("-m", message);
      if (!repository || !module) {
        return "Error: import requires repository and module";
      }
      cvsArgs.push(repository, module, "initial");
    } else if (op === "export") {
      cvsArgs.push("export");
      if (revision) cvsArgs.push("-r", revision);
      if (!target || !module) {
        return "Error: export requires target directory and module";
      }
      cvsArgs.push("-d", target, module);
    } else if (op === "history") {
      cvsArgs.push("history");
      if (target) cvsArgs.push(target);
      else cvsArgs.push(".");
    } else if (op === "annotate") {
      cvsArgs.push("annotate");
      if (target) cvsArgs.push(target);
      else cvsArgs.push(".");
    } else {
      cvsArgs.push(op);
      if (target) cvsArgs.push(target);
    }

    const result = await ctx!.exec("cvs", cvsArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
