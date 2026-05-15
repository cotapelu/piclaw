import { Type } from "typebox";

export const nethogsSchema = Type.Object({
  command: Type.Optional(Type.String()),
  interface: Type.Optional(Type.String()),
  refresh: Type.Optional(Type.Number()),
  version: Type.Optional(Type.Boolean()),
  help: Type.Optional(Type.Boolean()),
  monitor_mode: Type.Optional(Type.Boolean()),
});

export async function executeNethogs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, interface: iface, refresh, version, help, monitor_mode } = args;
  const timeout = 15000;
  try {
    if (version) {
      const result = await ctx!.exec("nethogs", ["-V"], { cwd, signal, timeout }).catch(() => ({ stdout: "", stderr: "nethogs not found" }));
      return result.stdout || result.stderr;
    }

    if (help) {
      const result = await ctx!.exec("nethogs", ["-h"], { cwd, signal, timeout }).catch(() => ({ stdout: "", stderr: "nethogs help not available" }));
      return (result.stdout || result.stderr).split('\n').slice(0,30).join('\n');
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const nethogsArgs: string[] = [];
    nethogsArgs.push("-d", String(refresh || 3));
    if (iface) nethogsArgs.push(iface);
    if (monitor_mode) nethogsArgs.push("-m");

    const result = await ctx!.exec("nethogs", nethogsArgs, { cwd, signal, timeout });
    const out = result.stdout || result.stderr;
    return out.split('\n').slice(0, 30).join('\n');
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
