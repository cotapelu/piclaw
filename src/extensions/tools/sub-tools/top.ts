import { Type } from "typebox";

export const topSchema = Type.Object({
  command: Type.String({ description: "top command (e.g., '-b -n 1' for batch mode, '-p 1234' for specific PID)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeTop(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command?: string; timeout?: number };
  try {
    const cmdArgs = command ? command.trim().split(/ \\s+/) : [];
    const result = await ctx!.exec("top", cmdArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `top error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}