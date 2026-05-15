import { Type } from "typebox";

export const mysqlSchema = Type.Object({
  command: Type.String({ description: "mysql command (e.g., '-u root -p', '-u root -p -e \"SELECT * FROM users\"', '-u root -p mydb')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeMysql(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const mysqlArgs = command ? command.split(/ \\s+/) : [];
    const result = await ctx!.exec("mysql", mysqlArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `mysql error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}