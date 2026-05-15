import { Type } from "typebox";

export const ssSchema = Type.Object({
  all: Type.Optional(Type.Boolean()),
  tcp: Type.Optional(Type.Boolean()),
  udp: Type.Optional(Type.Boolean()),
  listening: Type.Optional(Type.Boolean()),
  process: Type.Optional(Type.Boolean()),
  state: Type.Optional(Type.String()),
  port: Type.Optional(Type.Number()),
  ipv4: Type.Optional(Type.Boolean()),
  ipv6: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeSs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    all = false,
    tcp = false,
    udp = false,
    listening = false,
    process = false,
    timeout = 30000,
    state,
    port,
    ipv4 = false,
    ipv6 = false,
  } = args as {
    all?: boolean;
    tcp?: boolean;
    udp?: boolean;
    listening?: boolean;
    process?: boolean;
    timeout?: number;
    state?: string;
    port?: number;
    ipv4?: boolean;
    ipv6?: boolean;
  };
  try {
    const ssArgs: string[] = [];
    if (ipv4) ssArgs.push("-4");
    if (ipv6) ssArgs.push("-6");
    if (all) ssArgs.push("-a");
    if (tcp) ssArgs.push("-t");
    if (udp) ssArgs.push("-u");
    if (listening) ssArgs.push("-l");
    if (process) ssArgs.push("-p");
    if (state) ssArgs.push("state", state);
    if (port) ssArgs.push(`dport = :${port} or sport = :${port}`);
    const result = await ctx!.exec("ss", ssArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, all, tcp, udp, listening, process, state, port },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ss error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
