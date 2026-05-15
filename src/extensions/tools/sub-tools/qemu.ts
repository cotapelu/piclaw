import { Type } from "typebox";

export const qemuSchema = Type.Object({
  command: Type.String({ description: "qemu command (e.g., 'img create -f qcow2 disk.qcow2 10G', 'img convert -f raw -O qcow2 input.img output.qcow2', 'system-x86_64 -m 2G -hda disk.img')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeQemu(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000 } = args as { command: string; timeout?: number };
  try {
    const parts = command.trim().split(/ \\s+/);
    if (parts.length === 0) throw new Error("No qemu subcommand specified");
    const subcmd = parts[0];
    const tool = `qemu-${subcmd}`;
    const subArgs = parts.slice(1);
    const result = await ctx!.exec(tool, subArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, subcommand: subcmd },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `qemu error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}