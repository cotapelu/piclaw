import { Type } from "typebox";

export const quotaSchema = Type.Object({
  action: Type.Optional(Type.String()),
  user: Type.Optional(Type.String()),
  filesystem: Type.Optional(Type.String()),
  softLimit: Type.Optional(Type.Number()),
  hardLimit: Type.Optional(Type.Number()),
  unit: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeQuota(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    action = "report",
    user = "",
    filesystem = "",
    softLimit,
    hardLimit,
    unit = "blocks",
    timeout,
  } = args as {
    action?: string;
    user?: string;
    filesystem?: string;
    softLimit?: number;
    hardLimit?: number;
    unit?: "blocks" | "bytes";
    timeout?: number;
  };
  try {
    let cmd = "quota";
    if (action === "report") {
      cmd += ` -u ${user || ctx.cwd.split('/')[2]}`;
      if (filesystem) cmd += ` -g ${filesystem}`;
    } else if (action === "on" || action === "off") {
      cmd = `quota${action}`;
      if (filesystem) cmd += ` ${filesystem}`;
    } else if (action === "set" && user && filesystem) {
      const unitFlag = unit === "bytes" ? "-b" : "";
      cmd = `setquota -u ${user} ${softLimit || 0} ${hardLimit || 0} 0 0 ${filesystem}`;
    } else if (action === "remove" && user && filesystem) {
      cmd = `setquota -u ${user} 0 0 0 0 ${filesystem}`;
    } else if (action === "grace") {
      cmd = `repquota -a`;
    } else {
      return { content: [{ type: "text", text: `Unknown quota action or missing params` }], details: undefined, isError: true } as const;
    }
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, action, user, filesystem },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `quota error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
