import { Type } from "typebox";

export const archiveSchema = Type.Object({
  command: Type.Optional(Type.String()),
  tool: Type.Optional(Type.Enum(["tar", "gzip", "bzip2"])),
  files: Type.Optional(Type.String()),
  archive: Type.Optional(Type.String()),
  extract: Type.Optional(Type.String()),
  output_dir: Type.Optional(Type.String()),
  compress: Type.Optional(Type.Enum(["gzip", "bzip2", "xz", "none"])),
  list: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeArchive(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, tool, files, archive, extract, output_dir, compress, list, verbose, version } = args;
  const timeout = 180000;

  try {
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed }, isError: result.code !== 0 } as const;
    }

    if (version) {
      const [tarV, gzipV, bzip2V] = await Promise.all([
        ctx!.exec("tar", ["--version"], { cwd, signal, timeout: 10000 }).catch(() => ({ stdout: "", stderr: "tar not found", code: 1 })),
        ctx!.exec("gzip", ["--version"], { cwd, signal, timeout: 10000 }).catch(() => ({ stdout: "", stderr: "gzip not found", code: 1 })),
        ctx!.exec("bzip2", ["--version"], { cwd, signal, timeout: 10000 }).catch(() => ({ stdout: "", stderr: "bzip2 not found", code: 1 })),
      ]);
      const combined = `=== tar ===\n${tarV.stdout || tarV.stderr}\n=== gzip ===\n${gzipV.stdout || gzipV.stderr}\n=== bzip2 ===\n${bzip2V.stdout || bzip2V.stderr}`;
      return { content: [{ type: "text", text: combined }], details: {}, isError: false } as const;
    }

    if (list) {
      const archiveFile = archive || extract || "archive.tar";
      const result = await ctx!.exec("tar", ["-tf", archiveFile], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "list", archive: archiveFile }, isError: result.code !== 0 } as const;
    }

    if (extract) {
      const selectedTool = tool || "tar";
      if (selectedTool === "tar") {
        const tarArgs: string[] = [];
        if (output_dir) tarArgs.push("-C", output_dir);
        if (verbose) tarArgs.push("-v");
        tarArgs.push("-xf", extract);
        const result = await ctx!.exec("tar", tarArgs, { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "extract", tool: "tar", extract }, isError: result.code !== 0 } as const;
      } else if (selectedTool === "gzip") {
        const args: string[] = [];
        if (verbose) args.push("-v");
        args.push("-d", extract);
        const result = await ctx!.exec("gunzip", args, { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "extract", tool: "gzip", extract }, isError: result.code !== 0 } as const;
      } else if (selectedTool === "bzip2") {
        const args: string[] = [];
        if (verbose) args.push("-v");
        args.push("-d", extract);
        const result = await ctx!.exec("bunzip2", args, { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "extract", tool: "bzip2", extract }, isError: result.code !== 0 } as const;
      } else {
        return { content: [{ type: "text", text: `Unsupported tool for extraction: ${selectedTool}` }], details: undefined, isError: true } as const;
      }
    }

    if (archive || files) {
      const selectedTool = tool || "tar";
      const compressType = compress || "gzip";

      if (selectedTool === "tar") {
        const tarArgs: string[] = ["-c"];
        if (compressType === "gzip") tarArgs.push("-z");
        else if (compressType === "bzip2") tarArgs.push("-j");
        else if (compressType === "xz") tarArgs.push("-J");
        if (verbose) tarArgs.push("-v");
        const archiveName = archive || "archive.tar" + (compressType === "gzip" ? ".gz" : compressType === "bzip2" ? ".bz2" : compressType === "xz" ? ".xz" : "");
        tarArgs.push("-f", archiveName);
        if (files) {
          tarArgs.push(...files.trim().split(/\s+/));
        } else {
          tarArgs.push(".");
        }
        const result = await ctx!.exec("tar", tarArgs, { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "create", tool: "tar", archive: archiveName }, isError: result.code !== 0 } as const;
      } else if (selectedTool === "gzip") {
        const args: string[] = [];
        if (verbose) args.push("-v");
        const fileList = files ? files.trim().split(/\s+/) : ["."];
        args.push(...fileList);
        const result = await ctx!.exec("gzip", args, { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "create", tool: "gzip", files }, isError: result.code !== 0 } as const;
      } else if (selectedTool === "bzip2") {
        const args: string[] = [];
        if (verbose) args.push("-v");
        const fileList = files ? files.trim().split(/\s+/) : ["."];
        args.push(...fileList);
        const result = await ctx!.exec("bzip2", args, { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "create", tool: "bzip2", files }, isError: result.code !== 0 } as const;
      } else {
        return { content: [{ type: "text", text: `Unsupported tool for archive creation: ${selectedTool}` }], details: undefined, isError: true } as const;
      }
    }

    return { content: [{ type: "text", text: "Error: No action specified. Use version, extract, list, or provide files/archive to create." }], details: undefined, isError: true } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `archive error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
