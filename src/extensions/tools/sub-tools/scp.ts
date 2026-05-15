import { Type } from "typebox";

export const scpSchema = Type.Object({
  source: Type.String(),
  destination: Type.String(),
  recursive: Type.Optional(Type.Boolean()),
  port: Type.Optional(Type.Number()),
  user: Type.Optional(Type.String()),
  preserve: Type.Optional(Type.Boolean()),
  compress: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeScp(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    source,
    destination,
    recursive = false,
    port,
    user,
    preserve = false,
    compress = false,
    timeout = 30000,
  } = args as {
    source: string;
    destination: string;
    recursive?: boolean;
    port?: number;
    user?: string;
    preserve?: boolean;
    compress?: boolean;
    timeout?: number;
  };
  try {
    const scpArgs: string[] = [];
    if (recursive) scpArgs.push("-r");
    if (preserve) scpArgs.push("-p");
    if (compress) scpArgs.push("-C");
    if (port) scpArgs.push("-P", String(port));
    scpArgs.push(source, destination);
    const result = await ctx!.exec("scp", scpArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, source, destination, recursive },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `scp error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
