import { Type } from "typebox";

export const iftopSchema = Type.Object({
  command: Type.Optional(Type.String()),
  tool: Type.Optional(Type.String()),
  interface: Type.Optional(Type.String()),
  filter: Type.Optional(Type.String()),
  port: Type.Optional(Type.String()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
  help: Type.Optional(Type.Boolean()),
});

export async function executeIftop(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, tool, interface: iface, filter, port, verbose, version, help } = args;
  const timeout = 15000;
  try {
    const selectedTool = tool || "iftop";

    if (version) {
      if (selectedTool === "iptraf" || selectedTool === "iptraf-ng") {
        const result = await ctx!.exec("iptraf-ng", ["--version"], { cwd, signal, timeout }).catch(() => ({ stdout: "", stderr: "iptraf-ng not found" }));
        return result.stdout || result.stderr;
      } else {
        const result = await ctx!.exec("iftop", ["--version"], { cwd, signal, timeout }).catch(() => ({ stdout: "", stderr: "iftop not found" }));
        return result.stdout || result.stderr;
      }
    }

    if (help) {
      if (selectedTool === "iptraf" || selectedTool === "iptraf-ng") {
        const result = await ctx!.exec("iptraf-ng", ["--help"], { cwd, signal, timeout }).catch(() => ({ stdout: "", stderr: "iptraf-ng help not available" }));
        return (result.stdout || result.stderr).split('\n').slice(0,30).join('\n');
      } else {
        const result = await ctx!.exec("iftop", ["--help"], { cwd, signal, timeout }).catch(() => ({ stdout: "", stderr: "iftop help not available" }));
        return (result.stdout || result.stderr).split('\n').slice(0,30).join('\n');
      }
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (selectedTool === "iptraf" || selectedTool === "iptraf-ng") {
      const iptrafArgs: string[] = [];
      // iptraf-ng: -i interface, -t terse mode? Actually -i for interface, -B background batch?
      // We'll try: iptraf-ng -i iface -B (background, no UI) but may not output.
      // Not ideal, but we'll use simple command
      if (iface) iptrafArgs.push("-i", iface);
      if (port) iptrafArgs.push("-p", port);
      // Try to get some stats; maybe use -s for statistics?
      iptrafArgs.push("-B"); // batch mode
      const result = await ctx!.exec("iptraf-ng", iptrafArgs, { cwd, signal, timeout });
      if (result.stdout) {
        return result.stdout.split('\n').slice(0,50).join('\n');
      }
      return result.stderr || "iptraf-ng may require root privileges";
    }

    // iftop
    const iftopArgs: string[] = [];
    if (iface) iftopArgs.push("-i", iface);
    if (filter) iftopArgs.push("-f", filter);
    // Non-interactive: -n (no DNS), -N (no port names), -L lines to output
    iftopArgs.push("-n", "-N");
    if (verbose) {
      iftopArgs.push("-L", "5");
    } else {
      iftopArgs.push("-L", "1");
    }
    const result = await ctx!.exec("iftop", iftopArgs, { cwd, signal, timeout });
    const out = result.stdout || result.stderr;
    // Trim to first N lines
    return out.split('\n').slice(0, 20).join('\n');
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
