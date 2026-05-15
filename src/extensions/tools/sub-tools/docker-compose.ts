import { Type } from "typebox";

export const dockerComposeSchema = Type.Object({
  command: Type.String({ description: "docker-compose command (e.g., 'up -d', 'down', 'ps', 'build', 'logs -f')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeDockerCompose(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000 } = args as { command: string; timeout?: number };
  const targetCwd = cwd;
  try {
    const cmdArgs = command.trim().split(/ \\s+/);
    // Try docker compose (new plugin) first
    try {
      const result = await ctx!.exec("docker", ["compose", ...cmdArgs], { cwd: targetCwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, method: "docker-compose" },
        isError: result.code !== 0,
      } as const;
    } catch (e) {
      // Fallback to docker-compose (standalone)
      const result = await ctx!.exec("docker-compose", cmdArgs, { cwd: targetCwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, method: "docker-compose" },
        isError: result.code !== 0,
      } as const;
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `docker-compose error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}