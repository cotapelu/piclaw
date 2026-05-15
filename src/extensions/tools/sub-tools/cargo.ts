import { Type } from "typebox";

export const cargoSchema = Type.Object({
  command: Type.String({ description: "cargo/rustup command (e.g., 'cargo build', 'cargo run', 'cargo test', 'rustup update', 'rustup show')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeCargo(
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
    if (trimmed.startsWith("cargo ")) {
      tool = "cargo";
      toolArgs = trimmed.slice(6).trim().split(/ \\s+/);
    } else if (trimmed.startsWith("rustup ")) {
      tool = "rustup";
      toolArgs = trimmed.slice(7).trim().split(/ \\s+/);
      if (toolArgs.length === 0) toolArgs = ["show"]; // default
    } else {
      tool = "cargo";
      toolArgs = trimmed.split(/ \\s+/);
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `cargo error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}