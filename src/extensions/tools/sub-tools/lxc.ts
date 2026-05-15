import { Type } from "typebox";

export const lxcSchema = Type.Object({
  command: Type.String({ description: "lxc/lxd command (e.g., 'list', 'start mycontainer', 'stop mycontainer', 'exec mycontainer bash', 'info mycontainer', 'image list')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeLxc(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout } = args as { command: string; timeout?: number };
  try {
    const cmd = `lxc ${command}`;
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `lxc error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}