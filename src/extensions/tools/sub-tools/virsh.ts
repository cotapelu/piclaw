import { Type } from "typebox";

export const virshSchema = Type.Object({
  command: Type.String({ description: "virsh command (e.g., 'list --all', 'start myvm', 'shutdown myvm', 'destroy myvm', 'console myvm', 'edit myvm')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeVirsh(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000 } = args as { command: string; timeout?: number };
  try {
    const cmdArgs = command.trim().split(/ \\s+/);
    const result = await ctx!.exec("virsh", cmdArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `virsh error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}