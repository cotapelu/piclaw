import { Type } from "typebox";

export const atSchema = Type.Object({
  action: Type.Union([Type.Literal("list"), Type.Literal("add"), Type.Literal("remove"), Type.Literal("show")]),
  time: Type.Optional(Type.String()),
  command: Type.Optional(Type.String()),
  jobId: Type.Optional(Type.Number()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeAt(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { action, time, command, jobId, timeout = 30000 } = args as {
    action: string;
    time?: string;
    command?: string;
    jobId?: number | string;
    timeout?: number;
  };
  try {
    if (action === "list") {
      const result = await ctx!.exec("atq", [], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, action },
        isError: result.code !== 0,
      } as const;
    } else if (action === "add" && time && command) {
      // Need bash for pipe; escape carefully
      const escapedCommand = command.replace(/'/g, "'\\''");
      const escapedTime = (time || '').replace(/'/g, "'\\''");
      const cmd = `echo '${escapedCommand}' | at '${escapedTime}'`;
      const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, action, time },
        isError: result.code !== 0,
      } as const;
    } else if (action === "remove" && jobId != null) {
      const result = await ctx!.exec("atrm", [String(jobId)], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, action, jobId },
        isError: result.code !== 0,
      } as const;
    } else if (action === "show" && jobId != null) {
      const result = await ctx!.exec("at", ["-c", String(jobId)], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, action, jobId },
        isError: result.code !== 0,
      } as const;
    } else {
      return { content: [{ type: "text", text: `Invalid action or missing parameters` }], details: undefined, isError: true } as const;
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `at error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
