import { Type } from "typebox";

export const denoSchema = Type.Object({
  command: Type.String({ description: "deno/bun command (e.g., 'deno run main.ts', 'deno test', 'bun run main.ts', 'bun test')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeDeno(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000 } = args as { command: string; timeout?: number };
  try {
    const trimmed = command.trim();
    let tool: string;
    let toolArgs: string[];
    if (trimmed.startsWith("deno ") || trimmed.startsWith("deno,")) {
      tool = "deno";
      toolArgs = trimmed.slice(6).trim().split(/ \\s+/);
    } else if (trimmed.startsWith("bun ") || trimmed.startsWith("bun,")) {
      tool = "bun";
      toolArgs = trimmed.slice(5).trim().split(/ \\s+/);
    } else {
      tool = "deno";
      toolArgs = trimmed.split(/ \\s+/);
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, tool },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `deno/bun error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}