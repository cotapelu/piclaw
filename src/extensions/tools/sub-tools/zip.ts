import { Type } from "typebox";

export const zipSchema = Type.Object({
  command: Type.Optional(Type.String()),
  tool: Type.Optional(Type.Enum(["zip", "unzip"])),
  files: Type.Optional(Type.String()),
  archive: Type.Optional(Type.String()),
  extract: Type.Optional(Type.String()),
  output_dir: Type.Optional(Type.String()),
  password: Type.Optional(Type.String()),
  list: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean()),
  recurse: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeZip(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, tool, files, archive, extract, output_dir, password, list, verbose, recurse, version } = args;
  const timeout = 180000;

  try {
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed }, isError: result.code !== 0 } as const;
    }

    if (version) {
      const [zipV, unzipV] = await Promise.all([
        ctx!.exec("zip", ["-v"], { cwd, signal, timeout: 10000 }).catch(() => ({ stdout: "", stderr: "zip not found", code: 1 })),
        ctx!.exec("unzip", ["-v"], { cwd, signal, timeout: 10000 }).catch(() => ({ stdout: "", stderr: "unzip not found", code: 1 })),
      ]);
      const combined = `=== zip ===\n${zipV.stdout || zipV.stderr}\n=== unzip ===\n${unzipV.stdout || unzipV.stderr}`;
      return { content: [{ type: "text", text: combined }], details: {}, isError: false } as const;
    }

    if (list) {
      if (extract || archive) {
        const target = extract || archive;
        const result = await ctx!.exec("unzip", ["-l", target], { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "list", archive: target }, isError: result.code !== 0 } as const;
      }
      return { content: [{ type: "text", text: "Error: archive required for listing" }], details: undefined, isError: true } as const;
    }

    if (extract) {
      const selectedTool = tool || "unzip";
      if (selectedTool === "unzip") {
        const argsArr: string[] = [];
        if (output_dir) argsArr.push("-d", output_dir);
        if (password) argsArr.push("-P", password);
        if (verbose) argsArr.push("-v");
        argsArr.push(extract);
        const result = await ctx!.exec("unzip", argsArr, { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "extract", tool: "unzip", extract }, isError: result.code !== 0 } as const;
      } else {
        return { content: [{ type: "text", text: `Tool ${selectedTool} cannot extract. Use unzip.` }], details: undefined, isError: true } as const;
      }
    }

    if (archive || files) {
      const selectedTool = tool || "zip";
      if (selectedTool === "zip") {
        const argsArr: string[] = [];
        if (recurse !== false) argsArr.push("-r");
        if (verbose) argsArr.push("-v");
        if (password) argsArr.push("-P", password);
        const archiveName = archive || "archive.zip";
        argsArr.push(archiveName);
        if (files) {
          argsArr.push(...files.trim().split(/\s+/));
        } else {
          argsArr.push(".");
        }
        const result = await ctx!.exec("zip", argsArr, { cwd, signal, timeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "create", tool: "zip", archive: archiveName }, isError: result.code !== 0 } as const;
      } else {
        return { content: [{ type: "text", text: `Unsupported tool for creation: ${selectedTool}` }], details: undefined, isError: true } as const;
      }
    }

    return { content: [{ type: "text", text: "Error: No action specified. Use version, list, extract, or provide files/archive to create." }], details: undefined, isError: true } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `zip error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
