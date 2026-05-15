import { Type } from "typebox";

export const dmidecodeSchema = Type.Object({
  command: Type.String({ description: "dmidecode command (e.g., '-t memory', '-t processor', '-t bios', '-s system-manufacturer')" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeDmidecode(
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
    return { content: [{ type: "text", text: `dmidecode error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}