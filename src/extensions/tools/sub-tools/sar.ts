import { Type } from "typebox";

export const sarSchema = Type.Object({
  command: Type.String({ description: "sar command (e.g., '1 5' for 5 samples, '-n DEV' for network, '-u' for CPU, '-r' for memory)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeSar(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command?: string; timeout?: number };
  try {
    const cmdArgs = command ? command.trim().split(/ \\s+/) : [];
    const result = await ctx!.exec("sar", cmdArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `sar error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}