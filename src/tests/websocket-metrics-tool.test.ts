import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerWebsocketMetricsTool } from '../extensions/tools/websocket-metrics-tool.js';
import type { ExtensionAPI, AgentToolResult } from '@earendil-works/pi-coding-agent';

function createMockApi(): ExtensionAPI {
  return {
    on: vi.fn(() => () => {}),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(),
    registerMessageRenderer: vi.fn(),
    registerWidget: vi.fn(),
    registerHook: vi.fn(),
    sendMessage: vi.fn(),
    logger: console,
  } as any;
}

describe('websocket-metrics-tool', () => {
  let mockApi: ExtensionAPI;
  let capturedTool: any;

  beforeEach(() => {
    mockApi = createMockApi();
    vi.stubGlobal('fetch', vi.fn());
    // Register the tool; it will use the mocked fetch
    registerWebsocketMetricsTool(mockApi);
    // The tool is registered inside a 'session_start' event listener.
    // We need to simulate that event to get the tool definition.
    // The mockApi.on captures events; find the session_start handler and call it.
    const onCb = (mockApi.on as any).mock.calls.find(([event]: [string]) => event === 'session_start')?.[1];
    if (onCb) {
      // Simulate session start with empty context
      onCb({}, {});
    }
    // Extract the registered tool
    capturedTool = (mockApi.registerTool as any).mock.calls[0]?.[0];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should return message when no PI_WEBSOCKET_METRICS_URL set', async () => {
    // Ensure env var is not set
    delete process.env.PI_WEBSOCKET_METRICS_URL;

    const result = await capturedTool.execute({}, undefined, undefined, {});
    expect(result.isError).toBe(false);
    const text = (result.content[0].text as string);
    expect(text).toContain('not configured for metrics');
  });

  it('should fetch metrics from server successfully', async () => {
    process.env.PI_WEBSOCKET_METRICS_URL = 'http://127.0.0.1:8080';

    const mockData = {
      activeConnections: 2,
      totalConnections: 10,
      totalErrors: 0,
      totalPtySpawned: 10,
      uptimeSeconds: 123.45,
      startTime: '2025-01-01T00:00:00.000Z'
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await capturedTool.execute({}, undefined, undefined, {});
    expect(result.isError).toBe(false);
    const lines = (result.content as any[]).map(c => c.text);
    expect(lines.some(l => l.includes('Active connections: 2'))).toBe(true);
    expect(lines.some(l => l.includes('Total connections: 10'))).toBe(true);
    expect(result.details).toEqual(mockData);
  });

  it('should handle fetch errors', async () => {
    process.env.PI_WEBSOCKET_METRICS_URL = 'http://127.0.0.1:8080';
    (fetch as any).mockRejectedValue(new Error('network error'));

    const result = await capturedTool.execute({}, undefined, undefined, {});
    expect(result.isError).toBe(true);
    const text = (result.content[0].text as string);
    expect(text).toContain('Error fetching metrics');
  });

  it('should handle HTTP errors', async () => {
    process.env.PI_WEBSOCKET_METRICS_URL = 'http://127.0.0.1:8080';
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await capturedTool.execute({}, undefined, undefined, {});
    expect(result.isError).toBe(true);
    const text = (result.content[0].text as string);
    expect(text).toContain('HTTP 500');
  });
});
