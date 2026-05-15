import { Type } from "typebox";
import * as fs from "fs/promises";

export const tomlqSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  query: Type.Optional(Type.String()),
  raw: Type.Optional(Type.Boolean()),
  format: Type.Optional(Type.String()),
  indent: Type.Optional(Type.Number()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeTomlq(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, output, query, raw, format, indent, version } = args;
  const timeout = 30000;

  try {
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed },
        isError: result.code !== 0,
      } as const;
    }

    if (version) {
      const result = await ctx!.exec("tomlq", ["--version"], { cwd, signal, timeout });
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

    const tomlqArgs: string[] = [];
    if (query) tomlqArgs.push(query);
    if (raw) tomlqArgs.push("-r");
    if (format) tomlqArgs.push("-f", format);
    if (indent) tomlqArgs.push("-I", String(indent));
    tomlqArgs.push(input);

    const result = await ctx!.exec("tomlq", tomlqArgs, { cwd, signal, timeout });

    if (output && result.stdout) {
      try {
        await fs.writeFile(output, result.stdout, "utf8");
      } catch (e) {
        // ignore
      }
    }

    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input, output, query },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `tomlq error: ${error.message}` }],
      details: undefined,
      isError: true,
    } as const;
  }
}
