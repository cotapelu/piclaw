import { Type } from "typebox";

export const dotnetSchema = Type.Object({
  command: Type.String({ description: "dotnet/msbuild command (e.g., 'dotnet build', 'dotnet run', 'dotnet test', 'dotnet restore', 'msbuild')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeDotnet(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 60000 } = args as { command: string; timeout?: number };
  try {
    const trimmed = command.trim();
    let tool: string;
    let toolArgs: string[];
    if (trimmed.startsWith("dotnet ") || trimmed.startsWith("dotnet,")) {
      tool = "dotnet";
      toolArgs = trimmed.slice(7).trim().split(/ \\s+/);
    } else if (trimmed.startsWith("msbuild")) {
      tool = "msbuild";
      toolArgs = trimmed.slice(8).trim().split(/ \\s+/);
    } else {
      tool = "dotnet";
      toolArgs = trimmed.split(/ \\s+/);
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, tool },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `dotnet error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}