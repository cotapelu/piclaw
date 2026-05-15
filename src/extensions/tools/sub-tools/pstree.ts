import { Type } from "typebox";

export const pstreeSchema = Type.Object({
  command: Type.String({ description: "pstree command (e.g., '-p', '-h', '-u username', '-p 1234')" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executePstree(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command?: string; timeout?: number };
  try {
    const cmdArgs = command ? command.trim().split(/ \\s+/) : [];
    const result = await ctx!.exec("pstree", cmdArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `pstree error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}