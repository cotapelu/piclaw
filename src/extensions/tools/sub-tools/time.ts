import { Type } from "typebox";

export const timeSchema = Type.Object({
  action: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  timezone: Type.Optional(Type.String()),
  dateString: Type.Optional(Type.String()),
  toTimezone: Type.Optional(Type.String()),
  amount: Type.Optional(Type.Number()),
  unit: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeTime(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    action = "now",
    format = "%Y-%m-%d %H:%M:%S",
    timezone,
    dateString,
    toTimezone,
    amount,
    unit = "minutes",
    timeout,
  } = args as {
    action?: string;
    format?: string;
    timezone?: string;
    dateString?: string;
    toTimezone?: string;
    amount?: number;
    unit?: string;
    timeout?: number;
  };
  try {
    let cmd = "";
    if (action === "now") {
      const tz = timezone ? `TZ=${timezone}` : "";
      cmd = `${tz} date "${format}"`;
    } else if (action === "parse") {
      const tz = timezone ? `TZ=${timezone}` : "";
      cmd = `${tz} date -d '${dateString}' +"${format}" 2>/dev/null || echo "Failed to parse"`;
    } else if (action === "convert") {
      if (!dateString || !toTimezone) {
        return { content: [{ type: "text", text: "convert requires dateString and toTimezone" }], details: undefined, isError: true } as const;
      }
      const tzFrom = timezone ? `TZ=${timezone}` : "";
      const tzTo = `TZ=${toTimezone}`;
      cmd = `${tzFrom} date -d '${dateString}' +%s | xargs -I{} ${tzTo} date -d @{} +"${format}"`;
    } else if (action === "add") {
      if (amount === undefined) {
        return { content: [{ type: "text", text: "add requires amount" }], details: undefined, isError: true } as const;
      }
      const tz = timezone ? `TZ=${timezone}` : "";
      cmd = `${tz} date -d "now + ${amount} ${unit}" +"${format}"`;
    } else if (action === "diff") {
      if (!dateString) {
        return { content: [{ type: "text", text: "diff requires dateString (second date)" }], details: undefined, isError: true } as const;
      }
      const tz = timezone ? `TZ=${timezone}` : "";
      cmd = `${tz} echo $(( $(date -d '${dateString}' +%s) - $(date +%s) ))`;
    } else {
      return { content: [{ type: "text", text: `Unknown action: ${action}` }], details: undefined, isError: true } as const;
    }
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout.trim() || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, action, timezone, format },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `time error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
