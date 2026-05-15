import { Type } from "typebox";

export const makeSchema = Type.Object({
  target: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
  jobs: Type.Optional(Type.Number()),
});

export async function executeMake(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { target = "", cwd: targetCwd, timeout = 60000, jobs } = args as {
    target?: string;
    cwd?: string;
    timeout?: number;
    jobs?: number;
  };
  try {
    const makeArgs: string[] = [];
    if (jobs && jobs > 1) makeArgs.push("-j", String(jobs));
    if (target) makeArgs.push(target);
    const result = await ctx!.exec("make", makeArgs, { cwd: targetCwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, cwd: targetCwd, target },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Make error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
