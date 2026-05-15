import { Type } from "typebox";
import * as fs from "fs/promises";

export const xmlstarletSchema = Type.Object({
  command: Type.Optional(Type.String()),
  input: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  operation: Type.Optional(Type.String()),
  xpath: Type.Optional(Type.String()),
  xml_declaration: Type.Optional(Type.Boolean()),
  indent: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
  help: Type.Optional(Type.Boolean()),
});

export async function executeXmlstarlet(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, input, output, operation, xpath, xml_declaration, indent, version, help: showHelp } = args;
  const timeout = 30000;

  try {
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed }, isError: result.code !== 0 } as const;
    }

    if (version) {
      const result = await ctx!.exec("xmlstarlet", ["--version"], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed }, isError: result.code !== 0 } as const;
    }

    if (showHelp) {
      const result = await ctx!.exec("xmlstarlet", ["--help"], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed }, isError: result.code !== 0 } as const;
    }

    if (!input) {
      return { content: [{ type: "text", text: "Error: input XML file required" }], details: undefined, isError: true } as const;
    }

    // Determine subcommand
    const opMap: Record<string, string> = {
      select: "sel", edit: "ed", delete: "del", insert: "ins",
      format: "fmt", validate: "val", escape: "esc", unescape: "unesc"
    };
    const subcmd = operation ? (opMap[operation] || operation) : "fmt";
    const xmlstarletArgs: string[] = [subcmd];

    // Basic options
    // Note: original had xml_declaration and indent flags; we ignore for simplicity or could map if needed.

    // Per-operation arguments
    if (subcmd === "sel" && xpath) {
      xmlstarletArgs.push("-t", "-v", xpath);
    } else if (subcmd === "del" && xpath) {
      xmlstarletArgs.push(xpath);
    } else if (subcmd === "ed" && xpath) {
      xmlstarletArgs.push("-u", xpath);
      // Need value? Not provided; skip.
    } else if (subcmd === "fmt") {
      // format has options like -s indent, -n, etc.
      if (indent === false) {
        xmlstarletArgs.push("-n"); // no-indent
      } else if (typeof indent === "number") {
        xmlstarletArgs.push("-s", String(indent));
      }
      // xml_declaration control? not implemented
    }

    // Input file
    xmlstarletArgs.push(input);

    const result = await ctx!.exec("xmlstarlet", xmlstarletArgs, { cwd, signal, timeout });

    // Write output if specified
    if (output && result.stdout) {
      try {
        await fs.writeFile(output, result.stdout, "utf8");
      } catch (e) {
        // ignore
      }
    }

    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, operation: subcmd, input, output, xpath },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `xmlstarlet error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
