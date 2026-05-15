import { Type } from "typebox";

export const duSchema = Type.Object({
  path: Type.Optional(Type.String()),
  human: Type.Optional(Type.Boolean()),
  maxDepth: Type.Optional(Type.Number()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeDu(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { path = ".", human = true, maxDepth, timeout = 30000 } = args as {
    path?: string;
    human?: boolean;
    maxDepth?: number;
    timeout?: number;
  };
  try {
    const duArgs: string[] = [];
    if (human) duArgs.push("-h");
    if (maxDepth !== undefined) duArgs.push("-d", String(maxDepth));
    duArgs.push(path);
    const result = await ctx!.exec("du", duArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, path, human, maxDepth },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `du error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
