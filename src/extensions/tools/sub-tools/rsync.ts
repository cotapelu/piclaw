import { Type } from "typebox";

export const rsyncSchema = Type.Object({
  source: Type.String(),
  destination: Type.String(),
  recursive: Type.Optional(Type.Boolean()),
  archive: Type.Optional(Type.Boolean()),
  compress: Type.Optional(Type.Boolean()),
  delete: Type.Optional(Type.Boolean()),
  dryRun: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean()),
  progress: Type.Optional(Type.Boolean()),
  port: Type.Optional(Type.Number()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeRsync(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    source,
    destination,
    recursive = true,
    archive = false,
    compress = true,
    delete: del = false,
    dryRun = false,
    verbose = false,
    progress = false,
    port,
    timeout = 60000,
  } = args as {
    source: string;
    destination: string;
    recursive?: boolean;
    archive?: boolean;
    compress?: boolean;
    delete?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
    progress?: boolean;
    port?: number;
    timeout?: number;
  };
  try {
    const rsyncArgs: string[] = [];
    if (recursive) rsyncArgs.push("-r");
    if (archive) rsyncArgs.push("-a");
    if (compress) rsyncArgs.push("-z");
    if (del) rsyncArgs.push("--delete");
    if (dryRun) rsyncArgs.push("-n");
    if (verbose) rsyncArgs.push("-v");
    if (progress) rsyncArgs.push("--progress");
    if (port) rsyncArgs.push("-e", `ssh -p ${port}`);
    rsyncArgs.push(source, destination);
    const result = await ctx!.exec("rsync", rsyncArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, source, destination, archive, compress },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `rsync error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
