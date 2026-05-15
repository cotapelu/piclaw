import { Type } from "typebox";

export const aptSchema = Type.Object({
  command: Type.Union([
    Type.Literal("install"),
    Type.Literal("remove"),
    Type.Literal("update"),
    Type.Literal("upgrade"),
    Type.Literal("search"),
    Type.Literal("list"),
    Type.Literal("show"),
  ]),
  packages: Type.Optional(Type.Array(Type.String())),
  update: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeApt(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, packages = [], update = false, timeout = 60000 } = args as {
    command: string;
    packages?: string[];
    update?: boolean;
    timeout?: number;
  };
  try {
    // Handle update separately
    if (update) {
      await ctx!.exec("apt-get", ["update"], { cwd, signal, timeout });
    }
    // Build arguments for apt/apt-get/apt-cache
    let tool = "apt-get";
    let toolArgs: string[] = [];
    if (command === "list") {
      tool = "apt";
      toolArgs = packages.length > 0 ? [...packages, "--installed"] : [];
      const result1 = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
      if (result1.code === 0 && result1.stdout.trim()) {
        return { content: [{ type: "text", text: result1.stdout }], details: { exitCode: result1.code, killed: result1.killed, command }, isError: false } as const;
      }
      const fallbackArgs = packages.length > 0 ? packages : ["apt"];
      const result2 = await ctx!.exec("apt-cache", ["policy", ...fallbackArgs], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result2.stdout || result2.stderr }], details: { exitCode: result2.code, killed: result2.killed, command }, isError: result2.code !== 0 } as const;
    } else if (command === "search") {
      tool = "apt-cache";
      toolArgs = ["search", ...packages];
    } else if (command === "show") {
      tool = "apt-cache";
      toolArgs = ["show", ...packages];
    } else {
      tool = "apt-get";
      toolArgs = ["-y", command, ...packages];
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, command },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `apt error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
