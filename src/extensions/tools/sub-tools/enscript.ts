import { Type } from "typebox";

export const enscriptSchema = Type.Object({
  command: Type.Optional(Type.String()),
  tool: Type.Optional(Type.Enum(["enscript", "a2ps"])),
  input: Type.String(),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  font: Type.Optional(Type.String()),
  font_size: Type.Optional(Type.Number()),
  columns: Type.Optional(Type.Number()),
  landscape: Type.Optional(Type.Boolean()),
  page_size: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeEnscript(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, tool, input, output, format, font, font_size, columns, landscape, page_size } = args;
  const timeout = 300000;
  try {
    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const toolName = tool || "enscript";
    const enscriptArgs: string[] = [];

    if (output) enscriptArgs.push("-o", output);
    if (font) enscriptArgs.push("--font=" + font);
    if (font_size) enscriptArgs.push("--font-size=" + String(font_size));
    if (columns) enscriptArgs.push("--columns=" + String(columns));
    if (landscape) enscriptArgs.push("--landscape");
    if (page_size) enscriptArgs.push("--media=" + page_size);
    if (format && format !== 'ps') {
      // enscript primarily outputs PostScript; for PDF it can pipe through ps2pdf? We'll ignore or treat as output extension.
      // We'll just ignore format for enscript; user should specify output with desired extension.
    }

    enscriptArgs.push(input);

    const result = await ctx!.exec(toolName, enscriptArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return { content: [{ type: "text", text: `enscript error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
