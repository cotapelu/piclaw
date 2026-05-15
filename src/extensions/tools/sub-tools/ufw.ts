import { Type } from "typebox";

export const ufwSchema = Type.Object({
  action: Type.Union([
    Type.Literal("status"),
    Type.Literal("enable"),
    Type.Literal("disable"),
    Type.Literal("allow"),
    Type.Literal("deny"),
    Type.Literal("delete"),
    Type.Literal("reload"),
    Type.Literal("reset"),
  ]),
  rule: Type.Optional(Type.String()),
  port: Type.Optional(Type.Number()),
  proto: Type.Optional(Type.String()),
  fromIp: Type.Optional(Type.String()),
  toIp: Type.Optional(Type.String()),
  comment: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeUfw(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { action, rule, port, proto = "tcp", fromIp, toIp, comment, timeout = 60000 } = args as {
    action: string;
    rule?: string;
    port?: number;
    proto?: string;
    fromIp?: string;
    toIp?: string;
    comment?: string;
    timeout?: number;
  };
  try {
    const ufwArgs: string[] = [];
    if (action === "status") {
      ufwArgs.push("status", "verbose");
    } else if (action === "enable") {
      ufwArgs.push("enable");
    } else if (action === "disable") {
      ufwArgs.push("disable");
    } else if (action === "reload") {
      ufwArgs.push("reload");
    } else if (action === "reset") {
      ufwArgs.push("--force", "reset");
    } else if (action === "allow" || action === "deny") {
      ufwArgs.push(action);
      const targetRule = rule || `${port}/${proto}`;
      ufwArgs.push(targetRule);
      if (fromIp) ufwArgs.push("from", fromIp);
      if (toIp) ufwArgs.push("to", toIp);
      if (comment) ufwArgs.push("comment", comment);
    } else if (action === "delete" && rule) {
      ufwArgs.push("delete", rule);
    } else {
      return { content: [{ type: "text", text: `Unknown ufw action or missing rule` }], details: undefined, isError: true } as const;
    }
    const result = await ctx!.exec("ufw", ufwArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, action, rule, fromIp, toIp },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ufw error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
