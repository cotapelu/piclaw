import { Type } from "typebox";

export const vmstatSchema = Type.Object({
  command: Type.String({ description: "vmstat command (e.g., '1 5' for 5 samples every 1s, '-s' for event counters, '-m' for slabinfo)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeVmstat(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command?: string; timeout?: number };
  try {
    const cmdArgs = command ? command.trim().split(/ \\s+/) : [];
    const result = await ctx!.exec("vmstat", cmdArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `vmstat error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}