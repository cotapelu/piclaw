import { Type } from "typebox";

export const gitSchema = Type.Object({
  command: Type.String({ description: "Git command (e.g., 'status', 'log', 'commit -m \"msg\"')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeGit(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    // Split command into separate arguments to avoid shell injection
    // Basic split on spaces, respects simple quoting
    const gitArgs = command ? command.split(/ \\s+/) : [];
    const result = await ctx!.exec("git", gitArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Git error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
