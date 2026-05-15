import { Type } from "typebox";

export const psSchema = Type.Object({
  options: Type.Optional(Type.String()),
  filter: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executePs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { options = "aux", filter, timeout = 30000 } = args as {
    options?: string;
    filter?: string;
    timeout?: number;
  };
  try {
    const psArgs = options ? options.split(/ \\s+/) : [];
    if (filter) {
      // Use grep to filter - need bash due to pipe
      const psCmd = "ps " + psArgs.join(" ");
      const grepCmd = `grep '${filter.replace(/'/g, "'\\''")}'`;
      const cmd = `${psCmd} | ${grepCmd}`;
      const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, options, filter },
        isError: result.code !== 0,
      } as const;
    } else {
      const result = await ctx!.exec("ps", psArgs, { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, options },
        isError: result.code !== 0,
      } as const;
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `ps error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
