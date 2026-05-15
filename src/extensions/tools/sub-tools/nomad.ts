import { Type } from "typebox";

export const nomadSchema = Type.Object({
  command: Type.String({ description: "nomad command (e.g., 'job run myjob.nomad', 'job status myjob', 'job stop myjob', 'node status')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeNomad(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout } = args as { command: string; timeout?: number };
  try {
    const cmd = `nomad ${command}`;
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `nomad error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}