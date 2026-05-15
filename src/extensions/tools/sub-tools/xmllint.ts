import { Type } from "typebox";

export const xmllintSchema = Type.Object({
  inputFile: Type.String(),
  outputFile: Type.Optional(Type.String()),
  format: Type.Optional(Type.Boolean()),
  validate: Type.Optional(Type.Boolean()),
  schema: Type.Optional(Type.String()),
  noout: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeXmllint(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { inputFile, outputFile, format = false, validate = false, schema, noout = false, timeout } = args as {
    inputFile: string;
    outputFile?: string;
    format?: boolean;
    validate?: boolean;
    schema?: string;
    noout?: boolean;
    timeout?: number;
  };
  try {
    let cmd = `xmllint ${inputFile}`;
    if (format) cmd += " --format";
    if (validate) cmd += " --validate";
    if (schema) cmd += ` --schema ${schema}`;
    if (noout) cmd += " --noout";
    if (outputFile) cmd += ` -o ${outputFile}`;
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, format, validate, schema },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `xmllint error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
