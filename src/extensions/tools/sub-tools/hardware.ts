import { Type } from "typebox";

export const hardwareSchema = Type.Object({
  command: Type.String({ description: "Hardware command (e.g., 'lsusb', 'lspci', 'lscpu', 'lsblk', 'lsusb -v', 'lspci -v', 'lsblk -o NAME,SIZE,TYPE')" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeHardware(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    // Determine which tool to use: lsusb, lspci, lscpu, or lsblk (default)
    let tool = "lsblk";
    let toolArgs: string[] = [];
    const trimmedCommand = command.trim();
    if (trimmedCommand.startsWith("lsusb") || trimmedCommand.includes("lsusb")) {
      tool = "lsusb";
      toolArgs = trimmedCommand.split(/ \\s+/).slice(1); // remove 'lsusb'
    } else if (trimmedCommand.startsWith("lspci") || trimmedCommand.includes("lspci")) {
      tool = "lspci";
      toolArgs = trimmedCommand.split(/ \\s+/).slice(1);
    } else if (trimmedCommand.startsWith("lscpu") || trimmedCommand.includes("lscpu")) {
      tool = "lscpu";
      toolArgs = trimmedCommand.split(/ \\s+/).slice(1);
    } else if (trimmedCommand.startsWith("lsblk") || trimmedCommand.includes("lsblk")) {
      tool = "lsblk";
      toolArgs = trimmedCommand.split(/ \\s+/).slice(1);
    } else {
      // No prefix, treat entire command as args to lsblk
      toolArgs = trimmedCommand ? trimmedCommand.split(/ \\s+/) : [];
    }
    const result = await ctx!.exec(tool, toolArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `hardware error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}