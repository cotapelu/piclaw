import { Type } from "typebox";

export const kubectlApplySchema = Type.Object({
  command: Type.String({ description: "kubectl apply/delete command (e.g., '-f deployment.yaml', '-k ./kustomize', 'delete pod mypod')" }),
  cwd: Type.Optional(Type.String()),
  context: Type.Optional(Type.String({ description: "Kubernetes context" })),
  timeout: Type.Optional(Type.Number()),
});

export async function executeKubectlApply(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout, context } = args as { command: string; timeout?: number; context?: string };
  try {
    let cmd = `kubectl ${command}`;
    if (context) {
      cmd = `kubectl --context ${context} ${command}`;
    }
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `kubectl error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}