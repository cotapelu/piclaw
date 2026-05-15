import { Type } from "typebox";

export const socatSchema = Type.Object({
  command: Type.Optional(Type.String()),
  listen: Type.Optional(Type.Boolean()),
  address: Type.Optional(Type.String()),
  connect: Type.Optional(Type.String()),
  file: Type.Optional(Type.String()),
  stdio: Type.Optional(Type.Boolean()),
  fork: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeSocat(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, listen, address, connect, file, stdio, fork, verbose, timeout, version } = args;
  const defaultTimeout = 30000;
  try {
    if (version) {
      const result = await ctx!.exec("socat", ["-V"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const socatArgs: string[] = [];

    // Determine endpoints
    const endpoint1 = address || "-";
    const endpoint2 = (() => {
      if (stdio && connect) return connect;
      if (file) return file;
      if (connect) return connect;
      return "-";
    })();

    if (listen && endpoint1.includes("LISTEN")) {
      socatArgs.push(endpoint1, endpoint2);
      if (fork) socatArgs.push("fork");
    } else {
      socatArgs.push(endpoint1, endpoint2);
    }

    if (verbose) socatArgs.push("-v");

    // timeout via -T? But that's per-socket; we can ignore.

    const result = await ctx!.exec("socat", socatArgs, { cwd, signal, timeout: defaultTimeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
