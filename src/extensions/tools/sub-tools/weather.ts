import { Type } from "typebox";

export const weatherSchema = Type.Object({
  location: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  units: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeWeather(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    location = "",
    format = "plain",
    units = "metric",
    timeout = 10,
  } = args as {
    location?: string;
    format?: string;
    units?: string;
    timeout?: number;
  };
  try {
    const locPart = location ? `${location}` : "";
    const unitFlag = units === "imperial" ? "u" : "m";
    const url = `https://wttr.in/${locPart}?${unitFlag}${format === "json" ? "j" : format === "raw" ? "0" : ""}`;
    const result = await ctx!.exec("bash", ["-c", `curl -s --connect-timeout ${timeout} '${url}'`], { cwd, signal });
    let output = result.stdout;
    if (format === "json") {
      try {
        const json = JSON.parse(output);
        output = JSON.stringify(json, null, 2);
      } catch {
        // keep raw
      }
    }
    return {
      content: [{ type: "text", text: output || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, location, format, units },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `weather error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
