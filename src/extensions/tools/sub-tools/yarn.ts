import { Type } from "typebox";

export const yarnSchema = Type.Object({
  command: Type.String({ description: "yarn/pnpm command (e.g., 'yarn install', 'yarn add lodash', 'pnpm install', 'pnpm add lodash')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeYarn(
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
    if (trimmed.startsWith("yarn ") || trimmed.startsWith("yarn,")) {
      tool = "yarn";
      toolArgs = trimmed.slice(5).trim().split(/ \\s+/);
    } else if (trimmed.startsWith("pnpm ") || trimmed.startsWith("pnpm,")) {
      tool = "pnpm";
      toolArgs = trimmed.slice(6).trim().split(/ \\s+/);
    } else {
      tool = "yarn";
      toolArgs = trimmed.split(/ \\s+/);
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, tool },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `yarn/pnpm error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}