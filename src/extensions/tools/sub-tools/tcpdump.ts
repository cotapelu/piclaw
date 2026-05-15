import { Type } from "typebox";

export const tcpdumpSchema = Type.Object({
  command: Type.Optional(Type.String()),
  interface: Type.Optional(Type.String()),
  filter: Type.Optional(Type.String()),
  count: Type.Optional(Type.Number()),
  snaplen: Type.Optional(Type.Number()),
  verbose: Type.Optional(Type.Boolean()),
  timestamp: Type.Optional(Type.String()),
  promiscuous: Type.Optional(Type.Boolean()),
  read_file: Type.Optional(Type.String()),
  version: Type.Optional(Type.Boolean()),
  help: Type.Optional(Type.Boolean()),
});

export async function executeTcpdump(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, interface: iface, filter, count, snaplen, verbose, timestamp, promiscuous, read_file, version, help } = args;
  const timeout = 30000;
  try {
    if (version) {
      const result = await ctx!.exec("tcpdump", ["--version"], { cwd, signal, timeout });
      return (result.stdout || result.stderr).split('\n').slice(0,5).join('\n');
    }
    if (help) {
      const result = await ctx!.exec("tcpdump", ["--help"], { cwd, signal, timeout });
      return (result.stdout || result.stderr).split('\n').slice(0,50).join('\n');
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const tcpdumpArgs: string[] = [];

    if (read_file) {
      tcpdumpArgs.push("-r", read_file);
    } else {
      if (iface) tcpdumpArgs.push("-i", iface);
      else tcpdumpArgs.push("-i", "any"); // default interface
      tcpdumpArgs.push("-s", String(snaplen || 96));
      if (count) tcpdumpArgs.push("-c", String(count));
      else tcpdumpArgs.push("-c", "10"); // default 10 packets
    }

    if (promiscuous === false) tcpdumpArgs.push("-p");

    // Verbosity: -v, -vv, -vvv
    if (verbose) {
      if (typeof verbose === "number") {
        for (let i = 0; i < Math.min(verbose, 3); i++) tcpdumpArgs.push("-v");
      } else {
        tcpdumpArgs.push("-v");
      }
    }

    if (timestamp) {
      // timestamp is string like 't', 'tt', 'ttt' etc.
      tcpdumpArgs.push(`-${timestamp}`);
    }

    if (filter) tcpdumpArgs.push(filter);

    // Resolve names? Use -nn to not resolve
    tcpdumpArgs.push("-nn");

    const result = await ctx!.exec("tcpdump", tcpdumpArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
