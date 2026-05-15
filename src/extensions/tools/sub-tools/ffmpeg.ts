import { Type } from "typebox";

export const ffmpegSchema = Type.Object({
  inputFile: Type.String(),
  outputFile: Type.String(),
  format: Type.Optional(Type.String()),
  codec: Type.Optional(Type.String()),
  bitrate: Type.Optional(Type.String()),
  resolution: Type.Optional(Type.String()),
  framerate: Type.Optional(Type.Number()),
  startTime: Type.Optional(Type.String()),
  duration: Type.Optional(Type.String()),
  extraArgs: Type.Optional(Type.Array(Type.String())),
  timeout: Type.Optional(Type.Number()),
});

export async function executeFfmpeg(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    inputFile,
    outputFile,
    format,
    codec,
    bitrate,
    resolution,
    framerate,
    startTime,
    duration,
    extraArgs = [],
    timeout = 300,
  } = args as {
    inputFile: string;
    outputFile: string;
    format?: string;
    codec?: string;
    bitrate?: string;
    resolution?: string;
    framerate?: number;
    startTime?: string;
    duration?: string;
    extraArgs?: string[];
    timeout?: number;
  };
  try {
    const ffmpegArgs: string[] = ["-i", inputFile];
    if (startTime) ffmpegArgs.push("-ss", startTime);
    if (duration) ffmpegArgs.push("-t", duration);
    if (codec) ffmpegArgs.push("-c:v", codec);
    if (codec && format === "mp3") ffmpegArgs.push("-c:a", "mp3");
    if (resolution) ffmpegArgs.push("-s", resolution);
    if (framerate) ffmpegArgs.push("-r", String(framerate));
    if (bitrate) ffmpegArgs.push("-b:v", bitrate);
    if (format) ffmpegArgs.push("-f", format);
    if (extraArgs.length > 0) ffmpegArgs.push(...extraArgs);
    ffmpegArgs.push(outputFile);

    const result = await ctx!.exec("ffmpeg", ffmpegArgs, { cwd, signal, timeout: timeout * 1000 });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ffmpeg error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
