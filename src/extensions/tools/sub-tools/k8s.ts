import { Type } from "typebox";

export const k8sSchema = Type.Object({
  command: Type.String({ description: "kubectl command (e.g., 'get pods', 'apply -f manifest.yaml')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
  context: Type.Optional(Type.String({ description: "K8s context" })),
});

export async function executeK8s(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000, context } = args as { command: string; timeout?: number; context?: string };
  try {
    const kubectlArgs: string[] = [];
    if (context) kubectlArgs.push("--context", context);
    kubectlArgs.push(...command.trim().split(/ \\s+/));
    const result = await ctx!.exec("kubectl", kubectlArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, context },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `kubectl error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
