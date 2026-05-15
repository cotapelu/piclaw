import { Type } from "typebox";

export const soxSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.String(),
  output: Type.String(),
  format: Type.Optional(Type.String()),
  channels: Type.Optional(Type.Number()),
  rate: Type.Optional(Type.Number()),
  bits: Type.Optional(Type.Number()),
  volume: Type.Optional(Type.Number()),
  trim: Type.Optional(Type.String()),
  reverse: Type.Optional(Type.Boolean()),
  normalize: Type.Optional(Type.Boolean()),
  fade: Type.Optional(Type.String()),
  speed: Type.Optional(Type.Number()),
  pitch: Type.Optional(Type.Number()),
  gain: Type.Optional(Type.Number()),
  noise: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeSox(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, output, format, channels, rate, bits, volume, trim, reverse, normalize, fade, speed, pitch, gain, noise } = args;
  const timeout = 300000;
  try {
    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const soxArgs: string[] = [];

    // Global options (before input)
    if (rate) soxArgs.push("-r", String(rate));
    if (channels) soxArgs.push("-c", String(channels));
    if (bits) soxArgs.push("-b", String(bits));
    if (format) soxArgs.push("-t", format);

    // Input and output
    soxArgs.push(input, output);

    // Effects (after output)
    if (volume !== undefined) soxArgs.push("vol", String(volume));
    if (trim) soxArgs.push("trim", trim);
    if (reverse) soxArgs.push("reverse");
    if (normalize) soxArgs.push("norm");
    if (fade) soxArgs.push("fade", fade);
    if (speed) soxArgs.push("speed", String(speed));
    if (pitch) soxArgs.push("pitch", String(pitch));
    if (gain) soxArgs.push("gain", String(gain));
    if (noise) soxArgs.push("noise", noise);

    const result = await ctx!.exec("sox", soxArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return { content: [{ type: "text", text: `sox error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
