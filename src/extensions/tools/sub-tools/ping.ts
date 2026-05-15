import { Type } from "typebox";

export const pingSchema = Type.Object({
  host: Type.String(),
  count: Type.Optional(Type.Number()),
  timeout: Type.Optional(Type.Number()),
  ipv6: Type.Optional(Type.Boolean()),
});

export async function executePing(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { host, count = 4, timeout = 2, ipv6 = false } = args as {
    host: string;
    count?: number;
    timeout?: number;
    ipv6?: boolean;
  };
  try {
    const pingArgs = [ipv6 ? "-6" : "-4", "-c", String(count), "-W", String(timeout), host];
    const result = await ctx!.exec("ping", pingArgs, { cwd, signal, timeout: count * timeout * 1000 + 5000 });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, host, count },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ping error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
