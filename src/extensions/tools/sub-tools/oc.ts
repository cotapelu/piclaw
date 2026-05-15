import { Type } from "typebox";

export const ocSchema = Type.Object({
  command: Type.String({ description: "oc command (e.g., 'login', 'projects', 'get pods', 'apply -f deployment.yaml', 'new-app nginx')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeOc(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout } = args as { command: string; timeout?: number };
  try {
    const cmd = `oc ${command}`;
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `oc error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}