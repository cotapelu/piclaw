import { Type } from "typebox";

export const yqSchema = Type.Object({
  filter: Type.String(),
  input: Type.Optional(Type.Any()),
  inputFile: Type.Optional(Type.String()),
  outputFile: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  rawOutput: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeYq(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { filter, input, inputFile, outputFile, format = "yaml", rawOutput = false, timeout = 30000 } = args as {
    filter: string;
    input?: any;
    inputFile?: string;
    outputFile?: string;
    format?: "json" | "yaml" | "yml";
    rawOutput?: boolean;
    timeout?: number;
  };
  try {
    const yqArgs: string[] = [];
    if (rawOutput) yqArgs.push("-r");
    if (outputFile) yqArgs.push("-o", outputFile);
    if (format === "json") yqArgs.push("-o=json");
    else if (format === "yaml") yqArgs.push("-o=yaml");
    yqArgs.push(filter);

    if (inputFile) {
      yqArgs.push(inputFile);
      const result = await ctx!.exec("yq", yqArgs, { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, filter },
        isError: result.code !== 0,
      } as const;
    } else if (input) {
      const content = typeof input === "string" ? input : JSON.stringify(input);
      const escaped = content.replace(/'/g, "'\\''");
      const cmd = `printf '%s' '${escaped}' | yq ${yqArgs.map(a => a.includes(' ') ? `'${a}'` : a).join(' ')}`;
      const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, filter },
        isError: result.code !== 0,
      } as const;
    } else {
      return { content: [{ type: "text", text: "Must provide input or inputFile" }], details: undefined, isError: true } as const;
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `yq error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
