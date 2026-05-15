import { Type } from "typebox";

export const passwordSchema = Type.Object({
  length: Type.Optional(Type.Number()),
  type: Type.Optional(Type.String()),
  count: Type.Optional(Type.Number()),
  noSpecial: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executePassword(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    length = 32,
    type = "alphanum",
    count = 1,
    noSpecial = false,
    timeout,
  } = args as {
    length?: number;
    type?: string;
    count?: number;
    noSpecial?: boolean;
    timeout?: number;
  };
  try {
    let cmd = "";
    if (type === "uuid") {
      cmd = "uuidgen";
    } else if (type === "hex") {
      cmd = `openssl rand -hex ${length}`;
    } else if (type === "pin") {
      cmd = `openssl rand -numeric ${length}`;
    } else if (type === "alphanum") {
      cmd = `tr -dc 'a-zA-Z0-9' </dev/urandom | head -c${length}`;
    } else if (type === "password") {
      let charClass = "A-Za-z0-9";
      if (!noSpecial) charClass += "!@#$%^&*()_+-=[]{}|;:,.<>?";
      cmd = `tr -dc '${charClass}' </dev/urandom | head -c${length}`;
    }
    const fullCmd = count > 1 ? `for i in $(seq 1 ${count}); do ${cmd}; echo; done` : cmd;
    const result = await ctx!.exec("bash", ["-c", fullCmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout.trim() }],
      details: { exitCode: result.code, killed: result.killed, type, length, count, noSpecial },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `password generation error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
