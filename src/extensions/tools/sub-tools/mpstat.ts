import { Type } from "typebox";

export const mpstatSchema = Type.Object({
  command: Type.String({ description: "mpstat command (e.g., '1 5' for 5 samples every 1s, '-P ALL' for all CPUs, '-u' for utilization)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeMpstat(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command?: string; timeout?: number };
  try {
    const cmdArgs = command ? command.trim().split(/ \\s+/) : [];
    const result = await ctx!.exec("mpstat", cmdArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `mpstat error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}