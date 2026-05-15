import { Type } from "typebox";

export const rubySchema = Type.Object({
  command: Type.String({ description: "ruby/gem/bundle command (e.g., 'ruby -v', 'ruby script.rb', 'gem install rails', 'bundle install')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeRuby(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000 } = args as { command: string; timeout?: number };
  try {
    const parts = command.trim().split(/\s+/);
    if (parts.length === 0) throw new Error("No command");
    const tool = parts[0];
    const toolArgs = parts.slice(1);
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, tool },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ruby error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
