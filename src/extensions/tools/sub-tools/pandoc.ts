import { Type } from "typebox";

export const pandocSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  from: Type.Optional(Type.String()),
  to: Type.Optional(Type.String()),
  template: Type.Optional(Type.String()),
  standalone: Type.Optional(Type.Boolean()),
  self_contained: Type.Optional(Type.Boolean()),
  metadata: Type.Optional(Type.String()),
  extract_media: Type.Optional(Type.String()),
  number_sections: Type.Optional(Type.Boolean()),
  toc: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executePandoc(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, output, from, to, template, standalone, self_contained, metadata, extract_media, number_sections, toc } = args;
  const timeout = 300000;
  try {
    if (command) {
      const cmdArgs = command.trim().split(/\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const pandocArgs: string[] = [];

    if (input) pandocArgs.push(input);
    if (output) pandocArgs.push("-o", output);
    if (from) pandocArgs.push("-f", from);
    if (to) pandocArgs.push("-t", to);
    if (template) pandocArgs.push("--template", template);
    if (standalone) pandocArgs.push("--standalone");
    if (self_contained) pandocArgs.push("--self-contained");
    if (metadata) {
      for (const kv of metadata.split(',')) {
        const trimmed = kv.trim();
        if (trimmed) pandocArgs.push("-M", trimmed);
      }
    }
    if (extract_media) pandocArgs.push("--extract-media", extract_media);
    if (number_sections) pandocArgs.push("--number-sections");
    if (toc) pandocArgs.push("--table-of-contents");

    const result = await ctx!.exec("pandoc", pandocArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return { content: [{ type: "text", text: `pandoc error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
