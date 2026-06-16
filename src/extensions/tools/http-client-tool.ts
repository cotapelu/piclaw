#!/usr/bin/env node

/**
 * HTTP Client Tool
 *
 * Perform HTTP requests (GET, POST, PUT, DELETE, PATCH) with optional headers and body.
 * Uses Node.js built-in fetch (requires Node 18+).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

/**
 * Execute HTTP request using fetch.
 */
async function executeHttpClient(
  _toolCallId: string,
  params: any,
  _signal: AbortSignal | undefined,
  _onUpdate: any,
  _ctx: any
): Promise<{
  isError: boolean;
  content: Array<{ type: "text"; text: string }>;
  details: any;
}> {
  // Destructure and validate parameters
  const url = params.url;
  const method = params.method || "GET";
  const headers = params.headers || {};
  const body = params.body;
  const timeout = params.timeout != null ? Number(params.timeout) : 30000;

  // Validate URL
  if (!url || typeof url !== "string") {
    return {
      isError: true,
      content: [{ type: "text", text: "Missing or invalid parameter: url (non-empty string required)" }],
      details: { error: "Invalid URL" },
    };
  }

  // Basic URL sanity check
  try {
    new URL(url);
  } catch {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid URL: ${url}` }],
      details: { error: "Invalid URL format" },
    };
  }

  // Validate method
  const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
  if (!validMethods.includes(method)) {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid method: ${method}. Valid methods: ${validMethods.join(", ")}` }],
      details: { error: "Invalid HTTP method" },
    };
  }

  // Check if body is provided with appropriate method
  if (body && !["POST", "PUT", "PATCH"].includes(method)) {
    return {
      isError: true,
      content: [{ type: "text", text: `Request body can only be used with POST, PUT, or PATCH methods (current: ${method})` }],
      details: { error: "Body not allowed for method" },
    };
  }

  // Prepare AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? body : undefined,
      signal: controller.signal,
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const responseBody = await response.text();

    clearTimeout(timeoutId);

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    };

    // Build a readable summary
    const summary = `HTTP ${method} ${url}\nStatus: ${response.status} ${response.statusText}\nHeaders:\n${Object.entries(responseHeaders).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\nBody:\n${responseBody}`;

    return {
      isError: response.status >= 400,
      content: [{ type: "text", text: summary }],
      details: result,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return {
        isError: true,
        content: [{ type: "text", text: `Request timed out after ${timeout}ms` }],
        details: { error: "Timeout", timeout },
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Request failed: ${error.message}` }],
      details: { error: error.message, stack: error.stack },
    };
  }
}

/**
 * Render HTTP client result.
 * Displays a formatted summary with optional color highlighting.
 */
function renderHttpClientResult(result: any, _options: any, theme: any): any {
  const content = result.content?.[0]?.text || result.details?.error || 'No output';
  return new Text(content);
}

/**
 * Register the HTTP client tool.
 */
export function registerHttpClientTool(api: ExtensionAPI): void {
  const tool = {
    name: "http-client",
    label: "HTTP Client",
    description: "Perform HTTP requests (GET, POST, PUT, DELETE, PATCH) with optional headers and body. Uses Node.js fetch.",
    promptSnippet: "http-client({ url: string, method?: string, headers?: object, body?: string, timeout?: number })",
    promptGuidelines: [
      "Use the http-client tool to interact with web APIs.",
      "Parameters:",
      "- url (required): The target URL.",
      "- method (optional): HTTP method (GET, POST, PUT, DELETE, PATCH). Default: GET.",
      "- headers (optional): Record of header key-value pairs.",
      "- body (optional): Request body as plain text (only for POST, PUT, PATCH).",
      "- timeout (optional): Timeout in milliseconds (default 30000).",
      "Be cautious with body content; for JSON, set Content-Type header and provide JSON string."
    ],
    parameters: {}, // Manual validation in execute
    execute: executeHttpClient,
    renderResult: renderHttpClientResult,
  };

  api.registerTool(tool);
}
