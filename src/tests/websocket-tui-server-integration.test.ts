import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startWebsocketTuiServer, getWebSocketServerMetrics } from '../websocket-tui-server.js';

describe('WebSocket TUI Server Integration', () => {
  let handle: { stop: () => void; server: any } | null = null;
  let port: number = 0;

  beforeAll(async () => {
    // Start server on port 0 (OS assigns free port)
    handle = startWebsocketTuiServer({
      port: 0,
      address: '127.0.0.1',
      token: null,
      cliArgs: ['--version'], // harmless arg; the child will exit quickly but that's fine for metrics test
      cwd: process.cwd(),
    });

    // Wait for the 'listening' event to ensure the server is bound
    await new Promise<void>((resolve, reject) => {
      handle.server.once('listening', () => resolve());
      handle.server.once('error', reject);
    });

    const addr = handle.server.address();
    if (!addr) throw new Error('Server did not start');
    if (typeof addr === 'string') {
      // For UNIX sockets, not our case
      throw new Error('Unexpected socket type');
    } else {
      port = addr.port;
    }
  });

  afterAll(() => {
    if (handle) {
      handle.stop();
    }
  });

  it('should serve HTML client at root', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('xterm');
  });

  it('should return JSON metrics at /metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/metrics`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('activeConnections');
    expect(data).toHaveProperty('totalConnections');
    expect(data).toHaveProperty('totalErrors');
    expect(data).toHaveProperty('totalPtySpawned');
    expect(data).toHaveProperty('uptimeSeconds');
    expect(typeof data.activeConnections).toBe('number');
    expect(data.activeConnections).toBeGreaterThanOrEqual(0);
  });

  it('should return Prometheus text at /prometheus-metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/prometheus-metrics`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('# HELP piclaw_websocket_active_connections');
    expect(text).toContain('# TYPE piclaw_websocket_active_connections gauge');
    expect(text).toMatch(/piclaw_websocket_active_connections \d+/);
  });

  it('should return 404 for unknown paths', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(res.status).toBe(404);
  });
});
