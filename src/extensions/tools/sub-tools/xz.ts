import { Type } from "typebox";
import * as fs from "fs/promises";

export const xzSchema = Type.Object({
  command: Type.Optional(Type.String()),
  files: Type.Optional(Type.String()),
  decompress: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  level: Type.Optional(Type.Number()),
  keep: Type.Optional(Type.Boolean()),
  force: Type.Optional(Type.Boolean()),
  test: Type.Optional(Type.Boolean()),
  list: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeXz(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, files, decompress, output, level, keep, force, test, list, verbose, version } = args;
  const timeout = 180000;

  try {
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed }, isError: result.code !== 0 } as const;
    }

    if (version) {
      const result = await ctx!.exec("xz", ["--version"], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed }, isError: result.code !== 0 } as const;
    }

    if (test) {
      const target = decompress || files;
      if (!target) return { content: [{ type: "text", text: "Error: file required for test" }], details: undefined, isError: true } as const;
      const xzArgs: string[] = ["-t", target];
      const result = await ctx!.exec("xz", xzArgs, { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "test", file: target }, isError: result.code !== 0 } as const;
    }

    if (list) {
      const target = decompress || files;
      if (!target) return { content: [{ type: "text", text: "Error: file required for list" }], details: undefined, isError: true } as const;
      const xzArgs: string[] = ["-l"];
      if (verbose) xzArgs.push("-v");
      xzArgs.push(target);
      const result = await ctx!.exec("xz", xzArgs, { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "list", file: target }, isError: result.code !== 0 } as const;
    }

    if (decompress) {
      const xzArgs: string[] = ["-d"];
      if (keep) xzArgs.push("-k");
      if (force) xzArgs.push("-f");
      if (output) xzArgs.push("-c"); // write to stdout for capture
      xzArgs.push(decompress);
      const result = await ctx!.exec("xz", xzArgs, { cwd, signal, timeout });

      if (output && result.stdout) {
        try {
          await fs.writeFile(output, result.stdout, "utf8");
        } catch (e) {
          // ignore
        }
      }

      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "decompress", file: decompress, output }, isError: result.code !== 0 } as const;
    }

    if (files) {
      const xzArgs: string[] = [];
      if (level !== undefined) xzArgs.push(`-${level}`);
      if (keep) xzArgs.push("-k");
      if (force) xzArgs.push("-f");
      if (verbose) xzArgs.push("-v");
      let needStdoutCapture = false;
      if (output) {
        xzArgs.push("-c");
        needStdoutCapture = true;
      }
      xzArgs.push(...files.trim().split(/\s+/));
      const result = await ctx!.exec("xz", xzArgs, { cwd, signal, timeout });

      if (needStdoutCapture && output && result.stdout) {
        try {
          await fs.writeFile(output, result.stdout, "utf8");
        } catch (e) {
          // ignore
        }
      }

      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "compress", files, output }, isError: result.code !== 0 } as const;
    }

    return { content: [{ type: "text", text: "Error: No action specified. Use version, test, list, decompress, or files to compress." }], details: undefined, isError: true } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `xz error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
