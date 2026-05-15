import { Type } from "typebox";

export const zypperSchema = Type.Object({
  command: Type.Optional(Type.String()),
  operation: Type.Optional(Type.String()),
  packages: Type.Optional(Type.String()),
  all: Type.Optional(Type.Boolean()),
  security: Type.Optional(Type.Boolean()),
  search: Type.Optional(Type.String()),
  info: Type.Optional(Type.String()),
  list: Type.Optional(Type.String()),
  patches: Type.Optional(Type.Boolean()),
  orphans: Type.Optional(Type.Boolean()),
  clean: Type.Optional(Type.Boolean()),
  yes: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeZypper(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, packages, all, security, search, info, list, patches, orphans, clean, yes, verbose, version } = args;
  const timeout = 300000;
  try {
    if (version) {
      const result = await ctx!.exec("zypper", ["--version"], { cwd, signal, timeout });
      return (result.stdout || result.stderr).split('\n').slice(0,3).join('\n');
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const zypperArgs: string[] = [];
    if (yes) zypperArgs.push("--no-confirm");
    if (verbose) zypperArgs.push("-v");

    const op = operation || "list";

    const pushPackages = (...prefix: string[]) => {
      if (packages) zypperArgs.push(...prefix, ...packages.trim().split(/\s+/));
    };

    if (op === "install" || op === "in") {
      zypperArgs.push("in");
      if (security) zypperArgs.push("--type", "patch");
      pushPackages();
    } else if (op === "remove" || op === "rm" || op === "delete") {
      zypperArgs.push("rm");
      pushPackages();
    } else if (op === "update" || op === "up") {
      zypperArgs.push("up");
      pushPackages();
    } else if (op === "patch") {
      zypperArgs.push("patch");
      if (security) zypperArgs.push("--security");
      pushPackages();
    } else if (op === "search" || op === "se") {
      zypperArgs.push("se");
      const pkg = search || packages;
      if (pkg) zypperArgs.push(...pkg.trim().split(/\s+/));
    } else if (op === "info" || op === "if") {
      zypperArgs.push("if");
      const pkg = info || packages;
      if (pkg) zypperArgs.push(...pkg.trim().split(/\s+/));
    } else if (op === "list" || op === "ls") {
      zypperArgs.push("ls");
      if (list === "patches") zypperArgs.push("patches");
      else if (list === "updates") zypperArgs.push("updates");
      else if (list === "packages") zypperArgs.push("packages");
      else if (list === "patterns") zypperArgs.push("patterns");
      else if (list === "products") zypperArgs.push("products");
      else if (patches) zypperArgs.push("patches");
    } else if (op === "remove-orphan" || op === "rm-orphan") {
      zypperArgs.push("rm-orphans");
    } else if (op === "clean") {
      zypperArgs.push("clean");
    } else if (op === "dist-upgrade" || op === "dup") {
      zypperArgs.push("dup");
      pushPackages();
    } else {
      zypperArgs.push(op);
      if (packages) zypperArgs.push(...packages.trim().split(/\s+/));
    }

    const result = await ctx!.exec("zypper", zypperArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
