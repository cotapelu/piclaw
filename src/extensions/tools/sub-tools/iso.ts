import { Type } from "typebox";

export const isoSchema = Type.Object({
  action: Type.Union([Type.Literal("create"), Type.Literal("info"), Type.Literal("mount"), Type.Literal("unmount")]),
  source: Type.String(),
  output: Type.Optional(Type.String()),
  volumeLabel: Type.Optional(Type.String()),
  mountpoint: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeIso(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { action, source, output, volumeLabel, mountpoint, timeout } = args as {
    action: string;
    source: string;
    output?: string;
    volumeLabel?: string;
    mountpoint?: string;
    timeout?: number;
  };
  try {
    let cmd = "";
    if (action === "create") {
      if (!output) return { content: [{ type: "text", text: "create requires output" }], details: undefined, isError: true } as const;
      const labelFlag = volumeLabel ? `-V "${volumeLabel}"` : "";
      cmd = `mkisofs -o '${output}' ${labelFlag} -R -J '${source}'`;
    } else if (action === "info") {
      cmd = `isoinfo -d -i '${source}'`;
    } else if (action === "mount") {
      const mnt = mountpoint || `/mnt/iso_${Date.now()}`;
      cmd = `mount -o loop '${source}' '${mnt}' && echo "Mounted at ${mnt}"`;
    } else if (action === "unmount") {
      const mnt = mountpoint || source;
      cmd = `umount '${mnt}'`;
    } else {
      return { content: [{ type: "text", text: `Unknown ISO action` }], details: undefined, isError: true } as const;
    }
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, action, source, output },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `iso error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
