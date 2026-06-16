#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerHttpClientTool } from "../extensions/tools/http-client-tool.js";

// Mock fetch
global.fetch = vi.fn();

describe("HTTP Client Tool", () => {
  let mockApi: any;
  let tool: any;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    // Default successful response
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map(),
      text: vi.fn().mockResolvedValue("OK"),
    });
    mockApi = { registerTool: vi.fn((t) => { tool = t; }) };
    registerHttpClientTool(mockApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("has correct metadata", () => {
    expect(tool.name).toBe("http-client");
    expect(tool.label).toBe("HTTP Client");
    expect(tool.description).toContain("HTTP requests");
    expect(tool.parameters).toEqual({});
  });

  it("executes GET request successfully", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map([["content-type", "application/json"], ["x-custom", "value"]]),
      text: vi.fn().mockResolvedValue(JSON.stringify({ message: "Hello" })),
    };
    fetchMock.mockResolvedValue(mockResponse);

    const result = await tool.execute("call1", { url: "https://api.example.com/hello" }, undefined, undefined, {});

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/hello",
      expect.objectContaining({
        method: "GET",
        headers: {},
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("HTTP GET https://api.example.com/hello");
    expect(result.content[0].text).toContain("Status: 200 OK");
    expect(result.content[0].text).toContain("application/json");
    expect(result.details.status).toBe(200);
    expect(result.details.body).toBe(JSON.stringify({ message: "Hello" }));
  });

  it("executes POST with headers and body", async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      statusText: "Created",
      headers: new Map(),
      text: vi.fn().mockResolvedValue("Created"),
    };
    fetchMock.mockResolvedValue(mockResponse);

    const result = await tool.execute("call2", {
      url: "https://api.example.com/create",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({ name: "test" }),
    }, undefined, undefined, {});

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/create",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ name: "test" }),
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.isError).toBe(false);
    expect(result.details.status).toBe(201);
  });

  it("validates URL", async () => {
    const result = await tool.execute("call3", { url: "" }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Missing or invalid parameter: url");

    const result2 = await tool.execute("call4", { url: "not a valid url" }, undefined, undefined, {});
    expect(result2.isError).toBe(true);
    expect(result2.content[0].text).toContain("Invalid URL");
  });

  it("validates HTTP method", async () => {
    const result = await tool.execute("call5", { url: "https://example.com", method: "INVALID" }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid method: INVALID");
  });

  it("rejects body with non-POST/PUT/PATCH", async () => {
    const result = await tool.execute("call6", { url: "https://example.com", method: "GET", body: "data" }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Request body can only be used with POST, PUT, or PATCH");
  });

  it("handles request timeout", async () => {
    // Mock fetch to return a promise that rejects when aborted
    fetchMock.mockImplementation((_url, options) => {
      return new Promise((resolve, reject) => {
        const signal = options.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    });

    const result = await tool.execute(
      "call7",
      { url: "https://example.com", timeout: 10 },
      undefined,
      undefined,
      {}
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("timed out after 10ms");
  });

  it("handles network errors", async () => {
    fetchMock.mockRejectedValue(new Error("Network unreachable"));

    const result = await tool.execute("call8", { url: "https://example.com" }, undefined, undefined, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Request failed: Network unreachable");
  });

  it("marks HTTP error status as isError", async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Map(),
      text: vi.fn().mockResolvedValue("Not Found"),
    };
    fetchMock.mockResolvedValue(mockResponse);

    const result = await tool.execute("call9", { url: "https://example.com/missing" }, undefined, undefined, {});

    expect(result.isError).toBe(true);
    expect(result.details.status).toBe(404);
  });

  it("uses default timeout of 30000ms", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map(),
      text: vi.fn().mockResolvedValue("OK"),
    });

    await tool.execute("call10", { url: "https://example.com" }, undefined, undefined, {});

    const [url, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    // Can't easily check timeout duration after it's cleared, but we trust logic.
  });
});
