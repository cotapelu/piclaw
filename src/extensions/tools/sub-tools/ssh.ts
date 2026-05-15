import { Type } from "typebox";

export const sshSchema = Type.Object({
  host: Type.String({ description: "SSH host" }),
  command: Type.String({ description: "Command to execute on remote host" }),
  user: Type.Optional(Type.String()),
  port: Type.Optional(Type.Number()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeSsh(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { host, command, user, port = 22, timeout = 30000 } = args as {
    host: string;
    command: string;
    user?: string;
    port?: number;
    timeout?: number;
  };
  try {
    // Build argument array directly to avoid shell injection
    const sshArgs: string[] = ["-p", String(port)];
    if (user) {
      sshArgs.push("-l", user);
    }
    const target = user ? `${user}@${host}` : host;
    sshArgs.push(target);
    // Append the remote command as separate arguments if present
    if (command) {
      sshArgs.push(command);
    }
    const result = await ctx!.exec("ssh", sshArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, host, user },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `SSH error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
