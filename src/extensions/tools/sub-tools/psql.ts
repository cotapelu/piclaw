import { Type } from "typebox";

export const psqlSchema = Type.Object({
  command: Type.String({ description: "psql command (e.g., '-U postgres -d mydb', '-U postgres -d mydb -c \"SELECT * FROM users\"')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executePsql(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const psqlArgs = command ? command.split(/ \\s+/) : [];
    const result = await ctx!.exec("psql", psqlArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `psql error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}