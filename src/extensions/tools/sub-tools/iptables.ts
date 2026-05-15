import { Type } from "typebox";

export const iptablesSchema = Type.Object({
  command: Type.String({ description: "iptables command (e.g., '-L', '-A INPUT -p tcp --dport 22 -j ACCEPT', '-F')" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeIptables(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000 } = args as { command: string; timeout?: number };
  try {
    const cmdArgs = command.trim().split(/ \\s+/);
    const result = await ctx!.exec("iptables", cmdArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `iptables error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}