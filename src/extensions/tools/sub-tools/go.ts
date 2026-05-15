import { Type } from "typebox";

export const goSchema = Type.Object({
  command: Type.String({ description: "go/godoc command (e.g., 'go build', 'go run main.go', 'go test', 'go get github.com/pkg/mod', 'godoc -http=:8080')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeGo(
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
    if (trimmed.startsWith("go ") || trimmed.startsWith("go,")) {
      tool = "go";
      toolArgs = trimmed.slice(3).trim().split(/ \\s+/);
    } else if (trimmed.startsWith("godoc ")) {
      tool = "godoc";
      toolArgs = trimmed.slice(7).trim().split(/ \\s+/);
    } else {
      tool = "go";
      toolArgs = trimmed.split(/ \\s+/);
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, tool },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `go error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}