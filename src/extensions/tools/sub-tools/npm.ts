import { Type } from "typebox";

export const npmSchema = Type.Object({
  pm: Type.Optional(Type.String({ description: "npm, yarn, pnpm (default: npm)" })),
  command: Type.String({ description: "npm command: install, run build, test, etc." }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeNpm(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { pm = "npm", command, cwd: targetCwd, timeout = 60000 } = args as {
    pm?: string;
    command: string;
    cwd?: string;
    timeout?: number;
  };
  try {
    // Split command into args for the package manager
    const commandArgs = command.trim().split(/ \\s+/);
    const result = await ctx!.exec(pm, commandArgs, { cwd: targetCwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, cwd: targetCwd, pm },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `${pm} error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
