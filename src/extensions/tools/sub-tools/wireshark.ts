import { Type } from "typebox";

export const wiresharkSchema = Type.Object({
  command: Type.Optional(Type.String()),
  tool: Type.Optional(Type.Enum(["tshark", "dumpcap"])),
  interface: Type.Optional(Type.String()),
  filter: Type.Optional(Type.String()),
  count: Type.Optional(Type.Number()),
  read_file: Type.Optional(Type.String()),
  output_file: Type.Optional(Type.String()),
  fields: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  verbose: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
  help: Type.Optional(Type.Boolean()),
});

export async function executeWireshark(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, tool, interface: iface, filter, count, read_file, output_file, fields, format, verbose, version, help } = args;
  const timeout = 30000;
  try {
    const selectedTool = (tool === "dumpcap") ? "dumpcap" : "tshark";

    if (version) {
      const result = await ctx!.exec(selectedTool, ["--version"], { cwd, signal, timeout });
      return (result.stdout || result.stderr).split('\n').slice(0,5).join('\n');
    }
    if (help) {
      const result = await ctx!.exec(selectedTool, ["--help"], { cwd, signal, timeout });
      return (result.stdout || result.stderr).split('\n').slice(0,50).join('\n');
    }

    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const cmdArgs: string[] = [];

    if (selectedTool === "dumpcap") {
      if (iface) cmdArgs.push("-i", iface);
      if (count) cmdArgs.push("-c", String(count));
      if (output_file) cmdArgs.push("-w", output_file);
      if (filter) cmdArgs.push("-f", filter);
      // dumpcap does not have verbose flag; ignore
    } else {
      // tshark
      if (read_file) {
        cmdArgs.push("-r", read_file);
        // When reading a file, filter is display filter
        if (filter) cmdArgs.push(filter);
      } else {
        if (iface) cmdArgs.push("-i", iface);
        if (count) cmdArgs.push("-c", String(count));
        else cmdArgs.push("-c", "10"); // default 10 packets
        if (filter) cmdArgs.push("-f", filter); // capture filter
      }

      if (output_file) {
        cmdArgs.push("-w", output_file);
      } else {
        // Output format for terminal
        if (fields) {
          cmdArgs.push("-T", "fields");
          const fieldList = fields.split(",");
          for (const f of fieldList) cmdArgs.push("-e", f);
        } else if (format === "json") {
          cmdArgs.push("-T", "json");
        } else if (format === "csv") {
          cmdArgs.push("-T", "csv");
        } else if (format === "pdml") {
          cmdArgs.push("-T", "pdml");
        } else if (format === "psml") {
          cmdArgs.push("-T", "psml");
        } else if (verbose) {
          cmdArgs.push("-V");
        } else {
          cmdArgs.push("-V"); // default to detailed for terminal
        }
      }
    }

    const result = await ctx!.exec(selectedTool, cmdArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
