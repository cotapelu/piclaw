import { Type } from "typebox";

export const iostatSchema = Type.Object({
  interval: Type.Optional(Type.Number()),
  count: Type.Optional(Type.Number()),
  devices: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeIostat(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { interval = 1, count = 1, devices = "", timeout = 30000 } = args as {
    interval?: number;
    count?: number;
    devices?: string;
    timeout?: number;
  };
  try {
    const iostatArgs: string[] = [];
    if (devices) {
      iostatArgs.push(...devices.trim().split(/\\s+/));
    }
    iostatArgs.push(String(interval), String(count));
    const result = await ctx!.exec("iostat", iostatArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, interval, count, devices },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `iostat error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
