import { Type } from "typebox";

export const mongodbSchema = Type.Object({
  command: Type.String({ description: "mongo/mongosh command (e.g., '', '--eval \"db.users.find()\"', 'mongodb://localhost:27017/mydb')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeMongodb(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const mongoshArgs = command ? command.split(/ \\s+/) : [];
    const result = await ctx!.exec("mongosh", mongoshArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    // Fallback to mongo if mongosh not available
    try {
      const mongoArgs = command ? command.split(/ \\s+/) : [];
      const result2 = await ctx!.exec("mongo", mongoArgs, { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result2.stdout || result2.stderr }],
        details: { exitCode: result2.code, killed: result2.killed },
        isError: result2.code !== 0,
      } as const;
    } catch (e2) {
      return { content: [{ type: "text", text: `mongodb error: ${error.message} (fallback: ${(e2 as Error).message})` }], details: undefined, isError: true } as const;
    }
  }
}