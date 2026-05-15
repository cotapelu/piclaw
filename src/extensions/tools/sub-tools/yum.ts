import { Type } from "typebox";

export const yumSchema = Type.Object({
  command: Type.Union([
    Type.Literal("install"),
    Type.Literal("remove"),
    Type.Literal("update"),
    Type.Literal("search"),
    Type.Literal("info"),
    Type.Literal("list"),
    Type.Literal("check-update"),
  ]),
  packages: Type.Optional(Type.Array(Type.String())),
  timeout: Type.Optional(Type.Number()),
});

export async function executeYum(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, packages = [], timeout = 30000 } = args as {
    command: string;
    packages?: string[];
    timeout?: number;
  };
  try {
    let toolArgs: string[] = [];
    if (command === "list") {
      toolArgs = ["list", ...packages];
    } else if (command === "search") {
      toolArgs = ["search", ...packages];
    } else if (command === "info") {
      toolArgs = ["info", ...packages];
    } else if (command === "check-update") {
      toolArgs = ["check-update"];
    } else {
      toolArgs = ["-y", command, ...packages];
    }
    const result = await ctx!.exec("yum", toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, command },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `yum error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
