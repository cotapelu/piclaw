import { Type } from "typebox";

export const emergeSchema = Type.Object({
  command: Type.Optional(Type.String()),
  operation: Type.Optional(Type.String()),
  packages: Type.Optional(Type.String()),
  world: Type.Optional(Type.Boolean()),
  deep: Type.Optional(Type.Number()),
  newuse: Type.Optional(Type.Boolean()),
  search: Type.Optional(Type.String()),
  info: Type.Optional(Type.String()),
  pretend: Type.Optional(Type.Boolean()),
  fetchonly: Type.Optional(Type.Boolean()),
  clean: Type.Optional(Type.Boolean()),
  depclean: Type.Optional(Type.Boolean()),
  yes: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeEmerge(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, packages, world, deep, newuse, search, info, pretend, fetchonly, clean, depclean, yes, verbose, version } = args;
  const timeout = 300000;
  try {
    if (version) {
      const result = await ctx!.exec("emerge", ["--version"], { cwd, signal, timeout });
      return (result.stdout || result.stderr).split('\n').slice(0,3).join('\n');
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const emergeArgs: string[] = [];

    if (pretend) emergeArgs.push("--pretend");
    if (fetchonly) emergeArgs.push("--fetchonly");
    if (clean) emergeArgs.push("--clean");
    if (depclean) emergeArgs.push("--depclean");
    if (yes) emergeArgs.push("--yes");
    if (verbose) emergeArgs.push("--verbose");
    if (world) emergeArgs.push("@world");
    if (deep !== undefined) emergeArgs.push(`--deep=${deep}`);
    if (newuse) emergeArgs.push("--newuse");

    const op = operation || "search";

    const pushPackages = (...prefix: string[]) => {
      if (packages) emergeArgs.push(...prefix, ...packages.trim().split(/\s+/));
    };

    if (op === "sync") {
      emergeArgs.push("--sync");
    } else if (op === "search" || op === "se") {
      emergeArgs.push("--search");
      const pkg = search || packages;
      if (pkg) emergeArgs.push(...pkg.trim().split(/\s+/));
    } else if (op === "install" || op === "i") {
      pushPackages();
    } else if (op === "uninstall" || op === "remove" || op === "rm") {
      emergeArgs.push("--unmerge");
      pushPackages();
    } else if (op === "update" || op === "up") {
      emergeArgs.push("--update");
      if (world) emergeArgs.push("@world");
      pushPackages();
    } else if (op === "info") {
      emergeArgs.push("--info");
      const pkg = info || packages;
      if (pkg) emergeArgs.push(...pkg.trim().split(/\s+/));
    } else if (op === "world") {
      emergeArgs.push("@world");
    } else if (op === "system") {
      emergeArgs.push("@system");
    } else if (op === "preserved-rebuild") {
      emergeArgs.push("--preserved-rebuild");
    } else if (op === "regen") {
      emergeArgs.push("--regen");
    } else if (op === "metadata") {
      emergeArgs.push("--metadata");
    } else if (op === "audit") {
      emergeArgs.push("--audit");
    } else {
      emergeArgs.push(op);
      if (packages) emergeArgs.push(...packages.trim().split(/\s+/));
    }

    const result = await ctx!.exec("emerge", emergeArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
