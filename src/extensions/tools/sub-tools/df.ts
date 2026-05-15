import { Type } from "typebox";

export const dfSchema = Type.Object({
  human: Type.Optional(Type.Boolean()),
  path: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeDf(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { human = true, path, timeout = 10000 } = args as {
    human?: boolean;
    path?: string;
    timeout?: number;
  };
  try {
    const dfArgs = human ? ["-h"] : [];
    if (path) dfArgs.push(path);
    const result = await ctx!.exec("df", dfArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, human },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `df error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
