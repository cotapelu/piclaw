import { Type } from "typebox";

export const cmakeSchema = Type.Object({
  command: Type.String({ description: "cmake/ninja command (e.g., 'cmake .', 'cmake --build .', 'ninja', 'ninja test')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeCmake(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 180000 } = args as { command: string; timeout?: number };
  try {
    const trimmed = command.trim();
    let tool: string;
    let toolArgs: string[];
    if (trimmed.startsWith("cmake ") || trimmed.startsWith("cmake,")) {
      tool = "cmake";
      toolArgs = trimmed.slice(7).trim().split(/ \\s+/);
    } else if (trimmed.startsWith("ninja")) {
      tool = "ninja";
      toolArgs = trimmed.slice(6).trim().split(/ \\s+/);
    } else {
      tool = "cmake";
      toolArgs = trimmed.split(/ \\s+/);
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, tool },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `cmake error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}