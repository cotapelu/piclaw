import { Type } from "typebox";

export const wgetSchema = Type.Object({
  url: Type.String(),
  output: Type.Optional(Type.String()),
  continueFlag: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
  quiet: Type.Optional(Type.Boolean()),
  limitRate: Type.Optional(Type.String()),
  user: Type.Optional(Type.String()),
  headers: Type.Optional(Type.Record(Type.String(), Type.String())),
});

export async function executeWget(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    url,
    output,
    continueFlag = false,
    timeout = 30000,
    quiet = false,
    limitRate,
    user,
    headers = {},
  } = args as {
    url: string;
    output?: string;
    continueFlag?: boolean;
    timeout?: number;
    quiet?: boolean;
    limitRate?: string;
    user?: string;
    headers?: Record<string, string>;
  };
  try {
    const wgetArgs: string[] = ["wget"];

    if (output) wgetArgs.push("-O", output);
    if (continueFlag) wgetArgs.push("-c");
    if (quiet) wgetArgs.push("-q");
    if (limitRate) wgetArgs.push(`--limit-rate=${limitRate}`);
    // wget timeout is in seconds, convert from ms
    if (timeout) wgetArgs.push(`--timeout=${Math.ceil(timeout / 1000)}`);
    if (user) {
      const [username, password] = user.split(":");
      wgetArgs.push(`--user=${username}`);
      if (password) wgetArgs.push(`--password=${password}`);
    }

    for (const [key, value] of Object.entries(headers)) {
      wgetArgs.push(`--header=${key}:${value}`);
    }

    wgetArgs.push(url);

    const result = await ctx!.exec("wget", wgetArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, url, output },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `wget error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
