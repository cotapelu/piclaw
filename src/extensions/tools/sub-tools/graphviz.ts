import { Type } from "typebox";

export const graphvizSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  layout: Type.Optional(Type.String()),
  version: Type.Optional(Type.Boolean()),
  list_formats: Type.Optional(Type.Boolean()),
});

export async function executeGraphviz(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, output, format, layout, version, list_formats } = args;
  const timeout = 60000;
  try {
    if (version) {
      const result = await ctx!.exec("dot", ["-V"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (!input) {
      return { content: [{ type: "text", text: "Error: input DOT file required" }], details: undefined, isError: true } as const;
    }

    const tool = layout || "dot";
    const gvArgs: string[] = [];

    const outFormat = format || "png";
    gvArgs.push("-T" + outFormat);

    if (output) {
      gvArgs.push("-o", output);
    }

    gvArgs.push(input);

    const result = await ctx!.exec(tool, gvArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return { content: [{ type: "text", text: `graphviz error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
