import { Type } from "typebox";

export const journalctlSchema = Type.Object({
  unit: Type.Optional(Type.String()),
  since: Type.Optional(Type.String()),
  lines: Type.Optional(Type.Number()),
  follow: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeJournalctl(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { unit, since, lines = 100, follow = false, timeout = 30000 } = args as {
    unit?: string;
    since?: string;
    lines?: number;
    follow?: boolean;
    timeout?: number;
  };
  try {
    const journalctlArgs: string[] = ["-n", String(lines)];
    if (unit) journalctlArgs.push("-u", unit);
    if (since) journalctlArgs.push("--since", since);
    if (follow) journalctlArgs.push("-f");
    const result = await ctx!.exec("journalctl", journalctlArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, unit, since, lines, follow },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `journalctl error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
