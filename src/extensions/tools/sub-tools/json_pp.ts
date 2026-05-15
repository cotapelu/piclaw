import { Type } from "typebox";
import * as fs from "fs/promises";

export const json_ppSchema = Type.Object({
  command: Type.Optional(Type.String()),
  tool: Type.Optional(Type.Enum(["json_pp", "jsonschema"])),
  input: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
  schema: Type.Optional(Type.String()),
  pretty: Type.Optional(Type.Boolean()),
  indent: Type.Optional(Type.Number()),
  validate: Type.Optional(Type.Boolean()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeJson_pp(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, tool, input, output, schema, pretty, indent, validate, version } = args;
  const timeout = 30000;

  try {
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed },
        isError: result.code !== 0,
      } as const;
    }

    if (version) {
      // Show both versions if possible
      const resultJson = await ctx!.exec("json_pp", ["-v"], { cwd, signal, timeout }).catch(() => ({ stdout: "", stderr: "json_pp not found", code: 1 }));
      const resultSchema = await ctx!.exec("jsonschema", ["--version"], { cwd, signal, timeout }).catch(() => ({ stdout: "", stderr: "jsonschema not found", code: 1 }));
      const combined = `json_pp: ${resultJson.stdout || resultJson.stderr}\njsonschema: ${resultSchema.stdout || resultSchema.stderr}`;
      return {
        content: [{ type: "text", text: combined }],
        details: {},
        isError: false,
      } as const;
    }

    if (!input) {
      return {
        content: [{ type: "text", text: "Error: input file required" }],
        details: undefined,
        isError: true,
      } as const;
    }

    const selectedTool = tool || "json_pp";

    if (selectedTool === "jsonschema") {
      // jsonschema: validate instance against schema
      const jsonschemaArgs: string[] = [];
      if (validate || schema) {
        jsonschemaArgs.push("--instance");
        if (schema) jsonschemaArgs.push(schema);
      } else {
        // No validation requested; maybe just show version?
        // but we handled version above, so this is error?
        // We'll just run with instance only? Might fail. Instead, return error.
        return {
          content: [{ type: "text", text: "Error: jsonschema requires schema or validate=true" }],
          details: undefined,
          isError: true,
        } as const;
      }
      jsonschemaArgs.push(input);
      const result = await ctx!.exec("jsonschema", jsonschemaArgs, { cwd, signal, timeout });
      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, tool: "jsonschema", input, schema },
        isError: result.code !== 0,
      } as const;
    } else {
      // json_pp
      const json_ppArgs: string[] = [];
      if (pretty !== false) json_ppArgs.push("-f");
      if (indent) json_ppArgs.push("-json_opt", `indent,${indent}`);
      // json_pp reads from stdin or file? It can take file as argument.
      json_ppArgs.push(input);
      const result = await ctx!.exec("json_pp", json_ppArgs, { cwd, signal, timeout });

      if (output && result.stdout) {
        try {
          await fs.writeFile(output, result.stdout, "utf8");
        } catch (e) {
          // ignore
        }
      }

      return {
        content: [{ type: "text", text: result.stdout || result.stderr }],
        details: { exitCode: result.code, killed: result.killed, tool: "json_pp", input, output },
        isError: result.code !== 0,
      } as const;
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `json_pp error: ${error.message}` }],
      details: undefined,
      isError: true,
    } as const;
  }
}
