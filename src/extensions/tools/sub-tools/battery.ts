import { Type } from "typebox";

export const batterySchema = Type.Object({
  command: Type.String({ description: "Battery command (upower: '-i /org/freedesktop/UPower/devices/battery_BAT0', pmset: '-g batt', 'upower -d' to list devices)" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeBattery(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 10000 } = args as { command?: string; timeout?: number };
  try {
    // If user provides explicit command, use bash (escape hatch)
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed },
        isError: result.code !== 0,
      } as const;
    }

    // Try upower (Linux)
    try {
      const devicesResult = await ctx!.exec("upower", ["-e"], { cwd, signal, timeout });
      const devices = (devicesResult.stdout || "").split("\n").filter((line: string) => line.includes("BAT"));
      if (devices.length > 0) {
        const bat = devices[0].trim();
        const result = await ctx!.exec("upower", ["-i", bat], { cwd, signal, timeout });
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          details: { exitCode: result.code, killed: result.killed, method: "upower", device: bat },
          isError: result.code !== 0,
        } as const;
      }
    } catch (e) {
      // upower not available or no battery, ignore
    }

    // Try pmset (macOS)
    try {
      const result = await ctx!.exec("pmset", ["-g", "batt"], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, method: "pmset" },
        isError: result.code !== 0,
      } as const;
    } catch (e) {
      // pmset not available
    }

    return {
      content: [{ type: "text", text: "No battery found or battery tools not available" }],
      details: {},
      isError: false,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `battery error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}