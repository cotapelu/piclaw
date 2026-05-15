import { Type } from "typebox";

export const wkhtmltopdfSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.String(),
  output: Type.String(),
  page_size: Type.Optional(Type.String()),
  orientation: Type.Optional(Type.String()),
  margin: Type.Optional(Type.String()),
  zoom: Type.Optional(Type.Number()),
  copies: Type.Optional(Type.Number()),
  header: Type.Optional(Type.String()),
  footer: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeWkhtmltopdf(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, output, page_size, orientation, margin, zoom, copies, header, footer } = args;
  const timeout = 60000;
  try {
    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const wkArgs: string[] = [];

    if (page_size) wkArgs.push("--page-size", page_size);
    if (orientation) wkArgs.push("--orientation", orientation);
    if (margin) wkArgs.push("--margin", margin);
    if (zoom) wkArgs.push("--zoom", String(zoom));
    if (copies) wkArgs.push("--copies", String(copies));
    if (header) wkArgs.push("--header-html", header); // or --header-center? Using header-html for HTML header; could also use --header-left/center/right but this is okay
    if (footer) wkArgs.push("--footer-html", footer);

    wkArgs.push(input, output);

    const result = await ctx!.exec("wkhtmltopdf", wkArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return { content: [{ type: "text", text: `wkhtmltopdf error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
