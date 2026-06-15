import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerUniversalTool } from "../extensions/tools/universal-tool.js";

// Mock the entire package to replace createBashToolDefinition
vi.mock("@earendil-works/pi-coding-agent", () => ({
  createBashToolDefinition: vi.fn(),
}));

import { createBashToolDefinition } from "@earendil-works/pi-coding-agent";

describe("Universal Tool Execution", () => {
  let mockBashExecute: any;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks(); // clear all mocks including createBashToolDefinition
    mockBashExecute = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "bash output" }],
      isError: false,
      details: {},
    });
    (createBashToolDefinition as any).mockReturnValue({ execute: mockBashExecute });
    mockApi = { registerTool: vi.fn() };
    registerUniversalTool(mockApi);
  });

  it("registers tool with correct metadata", () => {
    expect(mockApi.registerTool).toHaveBeenCalledWith(expect.objectContaining({
      name: "universal",
      label: "Universal Tool",
      description: expect.stringContaining("echo"),
      parameters: expect.objectContaining({
        type: "object",
        properties: expect.objectContaining({
          action: expect.objectContaining({
            enum: expect.arrayContaining(["echo", "system_info", "date", "uuid", "random", "calc"]),
          }),
        }),
      }),
    }));
  });

  it("executes echo action", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call1", { action: "echo", message: "Hello World" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(mockBashExecute).toHaveBeenCalledWith(
      "call1",
      expect.objectContaining({ command: "echo 'Hello World'" }),
      undefined,
      undefined,
      { cwd: "/repo" }
    );
    expect(createBashToolDefinition).toHaveBeenCalledWith("/repo", { commandPrefix: "" });
  });

  it("executes system_info action", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call2", { action: "system_info" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(mockBashExecute).toHaveBeenCalledWith(
      "call2",
      expect.objectContaining({ command: "uname -a && df -h" }),
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("executes date action", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call3", { action: "date" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(mockBashExecute).toHaveBeenCalledWith(
      "call3",
      expect.objectContaining({ command: "date" }),
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("executes uuid action", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call4", { action: "uuid" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(mockBashExecute).toHaveBeenCalledWith(
      "call4",
      expect.objectContaining({ command: "cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen" }),
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("executes random action with defaults", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call5", { action: "random" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(mockBashExecute).toHaveBeenCalledWith(
      "call5",
      expect.objectContaining({ command: "echo $((RANDOM % (100 - 0 + 1) + 0))" }),
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("executes random action with custom min and max", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call6", { action: "random", min: 10, max: 20 }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(mockBashExecute).toHaveBeenCalledWith(
      "call6",
      expect.objectContaining({ command: "echo $((RANDOM % (20 - 10 + 1) + 10))" }),
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("executes calc action with simple expression", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call7", { action: "calc", expression: "2+3*4" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(false);
    expect(mockBashExecute).toHaveBeenCalledWith(
      "call7",
      expect.objectContaining({ command: expect.stringMatching(/^echo "scale=6; 2\+3\*4" \| bc -l$/) }),
      undefined,
      undefined,
      { cwd: "/repo" }
    );
  });

  it("validates missing action", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call8", {}, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Missing required parameter: action");
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it("validates unknown action", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call9", { action: "unknown" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown action");
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it("validates echo missing message", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call10", { action: "echo" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("message");
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it("validates random invalid min/max (non-numbers)", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call11", { action: "random", min: "a", max: 10 }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("numbers");
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it("validates random min > max", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call12", { action: "random", min: 20, max: 10 }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("min > max");
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it("validates calc missing expression", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call13", { action: "calc" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("expression");
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it("validates calc invalid expression characters", async () => {
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call14", { action: "calc", expression: "alert(1)" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid expression");
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it("propagates bash error as isError", async () => {
    mockBashExecute.mockResolvedValue({ content: [{ type: "text", text: "error output" }], isError: true });
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call15", { action: "echo", message: "fail" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("error output");
  });

  it("includes action in details on success", async () => {
    mockBashExecute.mockResolvedValue({ content: [{ type: "text", text: "out" }], details: { foo: "bar" }, isError: false });
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call16", { action: "date" }, undefined, undefined, { cwd: "/repo" });
    expect(result.details).toEqual(expect.objectContaining({ foo: "bar", action: "date" }));
  });

  it("handles bash exception and returns error", async () => {
    mockBashExecute.mockRejectedValue(new Error("bash crashed"));
    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute("call17", { action: "uuid" }, undefined, undefined, { cwd: "/repo" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("❌ Error: bash crashed");
    expect(result.details).toEqual(expect.objectContaining({ error: "bash crashed", action: "uuid" }));
  });
});
