import { Type } from "typebox";

export const topSchema = Type.Object({
  command: Type.String({ description: "top command (e.g., '-b -n 1' for batch mode, '-p 1234' for specific PID)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeTop(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const topArgs = command ? command.split(/\s+/) : [];
    const result = await ctx!.exec("top", topArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `top error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

export const htopSchema = Type.Object({
  command: Type.String({ description: "htop command (e.g., '-p 1234' for specific PID, '-u username' for user)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeHtop(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const htopArgs = command ? command.split(/\s+/) : [];
    const result = await ctx!.exec("htop", htopArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `htop error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

export const vmstatSchema = Type.Object({
  command: Type.String({ description: "vmstat command (e.g., '1 5' for 5 samples every 1s, '-s' for event counters, '-m' for slabinfo)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeVmstat(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const vmstatArgs = command ? command.split(/\s+/) : [];
    const result = await ctx!.exec("vmstat", vmstatArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `vmstat error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

export const netstatSchema = Type.Object({
  all: Type.Optional(Type.Boolean()),
  tcp: Type.Optional(Type.Boolean()),
  udp: Type.Optional(Type.Boolean()),
  listening: Type.Optional(Type.Boolean()),
  route: Type.Optional(Type.Boolean()),
  iface: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeNetstat(
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
    route = false,
    iface = false,
    timeout = 30000,
  } = args as {
    all?: boolean;
    tcp?: boolean;
    udp?: boolean;
    listening?: boolean;
    route?: boolean;
    iface?: boolean;
    timeout?: number;
  };
  try {
    const netstatArgs: string[] = [];
    if (route) netstatArgs.push("-rn");
    else if (iface) netstatArgs.push("-i");
    else {
      if (all) netstatArgs.push("-a");
      if (tcp) netstatArgs.push("-t");
      if (udp) netstatArgs.push("-u");
      if (listening) netstatArgs.push("-l");
    }
    const result = await ctx!.exec("netstat", netstatArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, all, tcp, udp, listening, route, iface },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `netstat error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

export const ssSchema = Type.Object({
  listening: Type.Optional(Type.Boolean()),
  tcp: Type.Optional(Type.Boolean()),
  udp: Type.Optional(Type.Boolean()),
  all: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeSs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { listening = false, tcp = false, udp = false, all = false, timeout = 30000 } = args as {
    listening?: boolean;
    tcp?: boolean;
    udp?: boolean;
    all?: boolean;
    timeout?: number;
  };
  try {
    const ssArgs: string[] = [];
    if (listening) ssArgs.push("-l");
    if (tcp) ssArgs.push("-t");
    if (udp) ssArgs.push("-u");
    if (all) ssArgs.push("-a");
    const result = await ctx!.exec("ss", ssArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, listening, tcp, udp, all },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ss error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
