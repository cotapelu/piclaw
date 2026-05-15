import { Type } from "typebox";

export const crontabSchema = Type.Object({
  action: Type.Union([Type.Literal("list"), Type.Literal("add"), Type.Literal("remove")]),
  user: Type.Optional(Type.String()),
  schedule: Type.Optional(Type.String()),
  command: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeCrontab(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { action, user, schedule, command, timeout = 30000 } = args as {
    action: string;
    user?: string;
    schedule?: string;
    command?: string;
    timeout?: number;
  };
  try {
    const userPart = user ? `-u ${user}` : "";

    if (action === "list") {
      const result = await ctx!.exec("crontab", [userPart, "-l"].filter(Boolean) as string[], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, action, user },
        isError: result.code !== 0,
      } as const;
    } else if (action === "add" && schedule && command) {
      // Need bash for pipeline and subshell
      const newEntry = `${schedule} ${command}`.replace(/"/g, '\"');
      const cmd = `(crontab ${userPart} -l 2>/dev/null; echo "${newEntry}") | crontab ${userPart} -`;
      const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, action, user },
        isError: result.code !== 0,
      } as const;
    } else if (action === "remove" && command) {
      const escapedCommand = command.replace(/"/g, '\"');
      const cmd = `crontab ${userPart} -l 2>/dev/null | grep -v "${escapedCommand}" | crontab ${userPart} -`;
      const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, action, user },
        isError: result.code !== 0,
      } as const;
    } else {
      return { content: [{ type: "text", text: `Invalid action or missing params` }], details: undefined, isError: true } as const;
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `crontab error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
