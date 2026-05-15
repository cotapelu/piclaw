import { Type } from "typebox";

export const dnfSchema = Type.Object({
  command: Type.Optional(Type.String()),
  operation: Type.Optional(Type.String()),
  packages: Type.Optional(Type.String()),
  all: Type.Optional(Type.Boolean()),
  security: Type.Optional(Type.Boolean()),
  search: Type.Optional(Type.String()),
  info: Type.Optional(Type.String()),
  list: Type.Optional(Type.String()),
  history: Type.Optional(Type.Boolean()),
  autoremove: Type.Optional(Type.Boolean()),
  clean: Type.Optional(Type.Boolean()),
  yes: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeDnf(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, packages, all, security, search, info, list, history, autoremove, clean, yes, verbose, version } = args;
  const timeout = 300000;
  try {
    if (version) {
      const result = await ctx!.exec("dnf", ["--version"], { cwd, signal, timeout });
      return (result.stdout || result.stderr).split('\n').slice(0,5).join('\n');
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const dnfArgs: string[] = [];
    if (yes) dnfArgs.push("-y");
    if (verbose) dnfArgs.push("-v");

    const op = operation || "list";

    const pushPackages = (...prefix: string[]) => {
      if (packages) dnfArgs.push(...prefix, ...packages.trim().split(/\s+/));
    };

    if (op === "install" || op === "in") {
      dnfArgs.push("install");
      if (security) dnfArgs.push("--security");
      pushPackages();
    } else if (op === "remove" || op === "er" || op === "rm") {
      dnfArgs.push("remove");
      pushPackages();
    } else if (op === "update" || op === "up") {
      dnfArgs.push("update");
      pushPackages();
    } else if (op === "upgrade" || op === "distro-sync") {
      dnfArgs.push("upgrade");
      pushPackages();
    } else if (op === "search") {
      dnfArgs.push("search");
      const pkg = search || packages;
      if (pkg) dnfArgs.push(...pkg.trim().split(/\s+/));
    } else if (op === "info") {
      dnfArgs.push("info");
      const pkg = info || packages;
      if (pkg) dnfArgs.push(...pkg.trim().split(/\s+/));
    } else if (op === "list") {
      dnfArgs.push("list");
      if (list === "installed") dnfArgs.push("installed");
      else if (list === "available") dnfArgs.push("available");
      else if (list === "updates") dnfArgs.push("updates");
      else if (list === "extras") dnfArgs.push("extras");
      else if (list === "obsoletes") dnfArgs.push("obsoletes");
      else if (list === "recent") dnfArgs.push("recent");
      pushPackages();
    } else if (op === "history") {
      dnfArgs.push("history");
      if (history) dnfArgs.push("list");
    } else if (op === "autoremove") {
      dnfArgs.push("autoremove");
    } else if (op === "clean") {
      dnfArgs.push("clean", "all");
    } else if (op === "check-update") {
      dnfArgs.push("check-update");
    } else if (op === "provides" || op === "whatprovides") {
      dnfArgs.push("provides");
      pushPackages();
    } else if (op === "requires" || op === "deptree") {
      dnfArgs.push("requires");
      pushPackages();
    } else {
      dnfArgs.push(op);
      if (packages) dnfArgs.push(...packages.trim().split(/\s+/));
    }

    const result = await ctx!.exec("dnf", dnfArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
