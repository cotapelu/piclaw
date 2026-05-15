import { Type } from "typebox";

export const imagemagickSchema = Type.Object({
  command: Type.Optional(Type.String()),
  tool: Type.Optional(Type.Enum(["convert", "gm"])),
  input: Type.String(),
  output: Type.String(),
  resize: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  quality: Type.Optional(Type.Number()),
  rotate: Type.Optional(Type.Number()),
  flip: Type.Optional(Type.Boolean()),
  flop: Type.Optional(Type.Boolean()),
  grayscale: Type.Optional(Type.Boolean()),
  blur: Type.Optional(Type.Number()),
  sharpen: Type.Optional(Type.Number()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeImagemagick(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, tool, input, output, resize, format, quality, rotate, flip, flop, grayscale, blur, sharpen } = args;
  const timeout = 300000;
  try {
    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const toolName = tool || "convert";
    const imgArgs: string[] = [input];

    if (resize) imgArgs.push("-resize", resize);
    if (format) imgArgs.push("-format", format);
    if (quality) imgArgs.push("-quality", String(quality));
    if (rotate) imgArgs.push("-rotate", String(rotate));
    if (flip) imgArgs.push("-flip");
    if (flop) imgArgs.push("-flop");
    if (grayscale) imgArgs.push("-colorspace", "Gray");
    if (blur) imgArgs.push("-blur", String(blur));
    if (sharpen) imgArgs.push("-sharpen", String(sharpen));

    imgArgs.push(output);

    const result = await ctx!.exec(toolName, imgArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return { content: [{ type: "text", text: `imagemagick error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
