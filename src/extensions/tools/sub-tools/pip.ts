import { Type } from "typebox";

export const pipSchema = Type.Object({
  command: Type.String({ description: "pip/poetry/pipenv command (e.g., 'pip install requests', 'pip list', 'poetry install', 'poetry add requests', 'pipenv install', 'pipenv install requests')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executePip(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000 } = args as { command: string; timeout?: number };
  try {
    let tool: string;
    let toolArgs: string[];
    const trimmed = command.trim();
    if (trimmed.startsWith("pip ") || trimmed.startsWith("pip2 ") || trimmed.startsWith("pip3 ")) {
      const parts = trimmed.split(/ \\s+/);
      tool = parts[0];
      toolArgs = parts.slice(1);
    } else if (trimmed.startsWith("poetry ")) {
      const parts = trimmed.split(/ \\s+/);
      tool = parts[0];
      toolArgs = parts.slice(1);
    } else if (trimmed.startsWith("pipenv ")) {
      const parts = trimmed.split(/ \\s+/);
      tool = parts[0];
      toolArgs = parts.slice(1);
    } else {
      tool = "pip";
      toolArgs = trimmed.split(/ \\s+/);
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, tool },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `pip error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}