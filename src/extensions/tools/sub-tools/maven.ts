import { Type } from "typebox";

export const mavenSchema = Type.Object({
  command: Type.String({ description: "mvn/gradle/ant command (e.g., 'mvn clean install', 'mvn test', 'gradle build', 'gradle test', 'ant compile')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeMaven(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 300000 } = args as { command: string; timeout?: number };
  try {
    const trimmed = command.trim();
    let tool: string;
    let toolArgs: string[];
    if (trimmed.startsWith("mvn ") || trimmed.startsWith("mvn,")) {
      tool = "mvn";
      toolArgs = trimmed.slice(4).trim().split(/ \\s+/);
    } else if (trimmed.startsWith("gradle ")) {
      tool = "gradle";
      toolArgs = trimmed.slice(7).trim().split(/ \\s+/);
    } else if (trimmed.startsWith("ant ")) {
      tool = "ant";
      toolArgs = trimmed.slice(5).trim().split(/ \\s+/);
    } else {
      tool = "mvn";
      toolArgs = trimmed.split(/ \\s+/);
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, tool },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `maven error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}