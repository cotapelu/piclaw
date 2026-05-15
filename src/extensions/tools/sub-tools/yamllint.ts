import { Type } from "typebox";
import * as fs from "fs/promises";

export const yamllintSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.Optional(Type.String()),
  config_file: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  strict: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeYamllint(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, config_file, format, strict, version } = args;
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
      const result = await ctx!.exec("yamllint", ["--version"], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed },
        isError: result.code !== 0,
      } as const;
    }

    if (!input) {
      return {
        content: [{ type: "text", text: "Error: input file or directory required" }],
        details: undefined,
        isError: true,
      } as const;
    }

    const yamllintArgs: string[] = [];
    if (config_file) yamllintArgs.push("-c", config_file);
    if (format) yamllintArgs.push("-f", format);
    if (strict) yamllintArgs.push("--strict");
    yamllintArgs.push(input);

    const result = await ctx!.exec("yamllint", yamllintArgs, { cwd, signal, timeout });

    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `yamllint error: ${error.message}` }],
      details: undefined,
      isError: true,
    } as const;
  }
}
