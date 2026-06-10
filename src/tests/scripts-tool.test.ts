import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the entire fs/promises module
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { createBashToolDefinition } from "@earendil-works/pi-coding-agent";
vi.mock("@earendil-works/pi-coding-agent", () => ({
  createBashToolDefinition: vi.fn(() => ({ execute: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "bash output" }], isError: false, details: {} }) })),
}));

import { registerScriptsTool } from "../extensions/tools/scripts-tool";

const mockedReadFile = readFile as any;

describe("Scripts Tool", () => {
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = { registerTool: vi.fn(), registerCommand: vi.fn() };
    registerScriptsTool(mockApi);
  });

  it("registers tool and command", () => {
    expect(mockApi.registerTool).toHaveBeenCalledWith(expect.objectContaining({
      name: "scripts",
      label: "NPM Scripts",
      description: expect.stringContaining("List and run npm scripts"),
      parameters: expect.objectContaining({
        type: "object",
        properties: expect.objectContaining({
          action: expect.objectContaining({ enum: ["list", "run"] }),
          script: expect.objectContaining({ type: "string" }),
        }),
        required: ["action"],
      }),
    }));
    expect(mockApi.registerCommand).toHaveBeenCalledWith("scripts", expect.any(Object));
  });

  it("execute list returns script names", async () => {
    const pkg = { scripts: { build: "tsc", test: "vitest", lint: "eslint ." } };
    mockedReadFile.mockResolvedValue(JSON.stringify(pkg));

    const tool: any = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call1", { action: "list" }, undefined, undefined, { cwd: "/repo" });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("build");
    expect(result.content[0].text).toContain("test");
    expect(result.details.action).toBe("list");
    expect(result.details.count).toBe(3);
  });

  it("execute list when no scripts defined", async () => {
    mockedReadFile.mockResolvedValue(JSON.stringify({})); // no scripts

    const tool: any = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call2", { action: "list" }, undefined, undefined, { cwd: "/repo" });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe("No npm scripts defined in package.json.");
  });

  it("execute run with missing script param returns error", async () => {
    mockedReadFile.mockResolvedValue(JSON.stringify({ scripts: { build: "tsc" } }));

    const tool: any = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call3", { action: "run" }, undefined, undefined, { cwd: "/repo" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("'script' parameter");
  });

  it("execute run with non-existent script returns error", async () => {
    mockedReadFile.mockResolvedValue(JSON.stringify({ scripts: { build: "tsc" } }));

    const tool: any = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call4", { action: "run", script: "test" }, undefined, undefined, { cwd: "/repo" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("execute run executes npm run via bash tool", async () => {
    mockedReadFile.mockResolvedValue(JSON.stringify({ scripts: { build: "tsc" } }));
    const mockBashExecute = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "Build OK" }], isError: false });
    (createBashToolDefinition as any).mockReturnValue({ execute: mockBashExecute });

    const tool: any = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call5", { action: "run", script: "build" }, undefined, undefined, { cwd: "/repo" });

    expect(result.isError).toBe(false);
    expect(mockBashExecute).toHaveBeenCalledWith(
      "call5",
      { command: "npm run build" },
      undefined,
      undefined,
      { cwd: "/repo" }
    );
    expect(result.details.script).toBe("build");
  });

  it("execute unknown action returns error", async () => {
    mockedReadFile.mockResolvedValue(JSON.stringify({}));
    const tool: any = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call6", { action: "unknown" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown action");
  });

  it("command handler notifies scripts list", async () => {
    const pkg = { scripts: { start: "node server.js", dev: "nodemon" } };
    mockedReadFile.mockResolvedValue(JSON.stringify(pkg));
    const mockNotify = vi.fn();
    const ctx = { cwd: "/repo", ui: { notify: mockNotify } };
    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);
    expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining("Available scripts"), "info");
    expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining("scripts({ action: 'run'"), "info");
  });

  it("command handler notifies when no scripts", async () => {
    mockedReadFile.mockResolvedValue(JSON.stringify({}));
    const mockNotify = vi.fn();
    const ctx = { cwd: "/repo", ui: { notify: mockNotify } };
    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);
    expect(mockNotify).toHaveBeenCalledWith("No npm scripts defined.", "info");
  });
});
