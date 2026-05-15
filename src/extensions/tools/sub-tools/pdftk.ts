import { Type } from "typebox";

export const pdftkSchema = Type.Object({
  command: Type.Optional(Type.String()),
  tool: Type.Optional(Type.Enum(["pdftk", "qpdf"])),
  input: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  operation: Type.Optional(Type.String()),
  pages: Type.Optional(Type.String()),
  rotate: Type.Optional(Type.Number()),
  password: Type.Optional(Type.String()),
  flatten: Type.Optional(Type.Boolean()),
  compress: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executePdftk(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, tool, input, output, operation, pages, rotate, password, flatten, compress } = args;
  const timeout = 120000;
  try {
    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const toolName = tool || "pdftk";
    const op = operation || "info";

    if (toolName === "qpdf") {
      // Basic qpdf mapping
      const qpdfArgs: string[] = [];
      if (input) qpdfArgs.push(input);
      if (output) qpdfArgs.push(output);
      // For qpdf, --encrypt etc. Not covering all.
      const result = await ctx!.exec("qpdf", qpdfArgs, { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    // pdftk
    if (op === "info") {
      if (!input) return "Error: input required for info";
      const result = await ctx!.exec("pdftk", [input, "dump_data"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (op === "burst") {
      if (!input) return "Error: input required for burst";
      const outPattern = output || "out_%04d.pdf";
      const result = await ctx!.exec("pdftk", [input, "burst", "output", outPattern], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (op === "rotate") {
      if (!input || !output || rotate === undefined) return "Error: input, output, and rotate required";
      const pageSpec = pages || "1-end";
      const direction = (rotate === 90 || rotate === -270) ? "east" : (rotate === 180 ? "south" : (rotate === 270 || rotate === -90 ? "west" : "north"));
      const catArgs = ["cat", `${pageSpec}${direction}`];
      const result = await ctx!.exec("pdftk", [input, ...catArgs, "output", output], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    // Default: just pass through user-provided command? Or error.
    return { content: [{ type: "text", text: `Unsupported pdftk operation: ${operation}. Use command for custom.` }], details: undefined, isError: true } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `pdftk error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
