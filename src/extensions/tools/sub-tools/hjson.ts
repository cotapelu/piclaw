import { Type } from "typebox";
import * as fs from "fs/promises";

export const hjsonSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  indent: Type.Optional(Type.Number()),
  quote_keys: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeHjson(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, output, format, indent, quote_keys, version } = args;
  const timeout = 30000;

  try {
    // Escape hatch: raw command uses bash
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed },
        isError: result.code !== 0,
      } as const;
    }

    if (version) {
      const result = await ctx!.exec("hjson", ["--version"], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed },
        isError: result.code !== 0,
      } as const;
    }

    if (!input) {
      return {
        content: [{ type: "text", text: "Error: input file required" }],
        details: undefined,
        isError: true,
      } as const;
    }

    // Build args
    const hjsonArgs: string[] = [];
    if (format) hjsonArgs.push(`-${format}`);
    if (indent) hjsonArgs.push(`-I`, String(indent));
    if (quote_keys) hjsonArgs.push("-k");
    hjsonArgs.push(input);

    const result = await ctx!.exec("hjson", hjsonArgs, { cwd, signal, timeout });

    // Write output if specified
    if (output && result.stdout) {
      try {
        await fs.writeFile(output, result.stdout, "utf8");
      } catch (e) {
        // ignore write error, still return stdout
      }
    }

    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input, output },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `hjson error: ${error.message}` }],
      details: undefined,
      isError: true,
    } as const;
  }
}
