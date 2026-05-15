import { Type } from "typebox";

export const ps2pdfSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  device: Type.Optional(Type.String()),
  resolution: Type.Optional(Type.String()),
  paper_size: Type.Optional(Type.String()),
  compress: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executePs2pdf(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, output, device, resolution, paper_size, compress } = args;
  const timeout = 300000;
  try {
    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (!input || !output) {
      return "Error: input and output required for ps2pdf";
    }

    // Determine device based on output extension if not provided
    let dev = device;
    if (!dev) {
      if (output.endsWith('.pdf')) dev = 'pdfwrite';
      else if (output.endsWith('.ps')) dev = 'ps2write';
      else dev = 'pdfwrite';
    }

    const gsArgs: string[] = ["-dSAFER", "-dBATCH", "-dNOPAUSE"];
    if (resolution) gsArgs.push("-r", resolution);
    if (paper_size) gsArgs.push("-sPAPERSIZE", paper_size);
    if (compress) gsArgs.push("-dCompressPages=true");
    gsArgs.push("-sDEVICE=" + dev);
    gsArgs.push("-sOutputFile=" + output);
    gsArgs.push(input);

    const result = await ctx!.exec("gs", gsArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ps2pdf error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
