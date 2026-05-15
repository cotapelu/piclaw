import { Type } from "typebox";

export const helmSchema = Type.Object({
  command: Type.String({ description: "helm command (e.g., 'install myrelease chart', 'list', 'upgrade myrelease chart', 'uninstall myrelease')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeHelm(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout } = args as { command: string; timeout?: number };
  try {
    const cmd = `helm ${command}`;
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `helm error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}