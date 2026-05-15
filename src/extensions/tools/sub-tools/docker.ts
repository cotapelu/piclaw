import { Type } from "typebox";

export const dockerSchema = Type.Object({
  command: Type.String({ description: "Docker command (e.g., 'ps', 'images', 'run nginx')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeDocker(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    // Split docker command into args array to avoid shell injection
    const dockerArgs = command ? command.split(/ \\s+/) : [];
    const result = await ctx!.exec("docker", dockerArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Docker error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
