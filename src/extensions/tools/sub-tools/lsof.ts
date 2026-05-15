import { Type } from "typebox";

export const lsofSchema = Type.Object({
  command: Type.String({ description: "lsof command (e.g., '-i', '-i :8080', '-p 1234', '/var/log/syslog')" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeLsof(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const parts = command.trim().split(/ \\s+/);
    const tool = parts[0];
    const toolArgs = parts.slice(1);
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `lsof error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}