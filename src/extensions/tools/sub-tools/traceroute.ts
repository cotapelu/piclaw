import { Type } from "typebox";

export const tracerouteSchema = Type.Object({
  host: Type.String(),
  maxHops: Type.Optional(Type.Number()),
  timeout: Type.Optional(Type.Number()),
  ipv6: Type.Optional(Type.Boolean()),
});

export async function executeTraceroute(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { host, maxHops = 30, timeout = 2, ipv6 = false } = args as {
    host: string;
    maxHops?: number;
    timeout?: number;
    ipv6?: boolean;
  };
  try {
    const flag = ipv6 ? "-6" : "-4";
    const tracerouteArgs = [flag, "-m", String(maxHops), "-w", String(timeout), host];
    const result = await ctx!.exec("traceroute", tracerouteArgs, { cwd, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, host, maxHops },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `traceroute error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
