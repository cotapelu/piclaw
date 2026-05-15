import { Type } from "typebox";

export const redisSchema = Type.Object({
  command: Type.String({ description: "redis-cli command (e.g., '', 'GET mykey', 'SET mykey value', 'KEYS *')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeRedis(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const redisArgs = command ? command.split(/ \\s+/) : [];
    const result = await ctx!.exec("redis-cli", redisArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `redis error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}