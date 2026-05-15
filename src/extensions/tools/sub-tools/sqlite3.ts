import { Type } from "typebox";

export const sqlite3Schema = Type.Object({
  command: Type.String({ description: "sqlite3 command (e.g., 'mydb.db', 'mydb.db \"SELECT * FROM users\"', 'mydb.db \".tables\"')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeSqlite3(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout } = args as { command: string; timeout?: number };
  try {
    const cmd = `sqlite3 ${command}`;
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `sqlite3 error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}