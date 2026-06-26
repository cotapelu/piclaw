import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startWebsocketTuiServer, getWebSocketServerMetrics } from '../websocket-tui-server.js';
import { WebSocket as WSClient } from 'ws';

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

  it('should handle WebSocket connection and receive PTY output', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/tui`;
    const messages: string[] = [];
    const errors: any[] = [];

    await new Promise<void>((resolve, reject) => {
      const ws = new WSClient(wsUrl);
      ws.on('message', (data) => {
        messages.push(data.toString());
      });
      ws.on('error', (err) => {
        errors.push(err);
      });
      ws.on('close', () => {
        // Done
        resolve();
      });
      // No need to send anything; PTY runs --version and exits.
      // Set a timeout to avoid hanging forever if close doesn't happen.
      setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket did not close within 5s'));
      }, 5000);
    });

    // After close, check that we received some output containing version info
    const combined = messages.join('');
    // The version output should contain the word 'PiClaw' or a version number pattern
    expect(combined.length).toBeGreaterThan(0);
    // The child process prints version to stdout, which PTY forwards
    expect(combined).toMatch(/PiClaw|piclaw/);
    expect(errors).toHaveLength(0);
  });
});
