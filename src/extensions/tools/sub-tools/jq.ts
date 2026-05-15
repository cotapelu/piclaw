import { Type } from "typebox";

export const jqSchema = Type.Object({
  filter: Type.String(),
  input: Type.Optional(Type.Any()),
  inputFile: Type.Optional(Type.String()),
  outputFile: Type.Optional(Type.String()),
  rawOutput: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeJq(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { filter, input, inputFile, outputFile, rawOutput = false, timeout = 30000 } = args as {
    filter: string;
    input?: any;
    inputFile?: string;
    outputFile?: string;
    rawOutput?: boolean;
    timeout?: number;
  };
  try {
    const jqArgs: string[] = [];
    if (rawOutput) jqArgs.push("-r");
    if (outputFile) jqArgs.push("-o", outputFile);
    jqArgs.push(filter);

    if (inputFile) {
      jqArgs.push(inputFile);
      const result = await ctx!.exec("jq", jqArgs, { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, filter },
        isError: result.code !== 0,
      } as const;
    } else if (input) {
      const jsonString = typeof input === "string" ? input : JSON.stringify(input, null, 2);
      const escaped = jsonString.replace(/'/g, "'\\''");
      const cmd = `printf '%s' '${escaped}' | jq ${jqArgs.map(a => a.includes(' ') ? `'${a}'` : a).join(' ')}`;
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
    return { content: [{ type: "text", text: `jq error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
