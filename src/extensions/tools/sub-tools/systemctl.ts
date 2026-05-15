import { Type } from "typebox";

export const systemctlSchema = Type.Object({
  action: Type.Union([
    Type.Literal("start"),
    Type.Literal("stop"),
    Type.Literal("restart"),
    Type.Literal("reload"),
    Type.Literal("status"),
    Type.Literal("enable"),
    Type.Literal("disable"),
    Type.Literal("is-active"),
  ]),
  service: Type.String({ description: "Service name (e.g., nginx, docker)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeSystemctl(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { action, service, timeout = 30000 } = args as {
    action: string;
    service: string;
    timeout?: number;
  };
  try {
    const result = await ctx!.exec("systemctl", [action, service], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, action, service },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `systemctl error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
