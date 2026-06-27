import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startWebsocketTuiServer } from '../websocket-tui-server.js';
import { WebSocket as WSClient } from 'ws';
import { randomBytes, randomInt } from 'node:crypto';

describe('WebSocket TUI Server Fuzzing', () => {
  let handle: { stop: () => void; server: any } | null = null;
  let port: number = 0;

  beforeAll(async () => {
    handle = startWebsocketTuiServer({
      port: 0,
      address: '127.0.0.1',
      token: null,
      cliArgs: ['--version'],
      cwd: process.cwd(),
    });

    await new Promise<void>((resolve, reject) => {
      handle.server.once('listening', () => resolve());
      handle.server.once('error', reject);
    });

    const addr = handle.server.address();
    if (!addr) throw new Error('Server did not start');
    if (typeof addr === 'string') {
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

  it('should survive many random messages without crashing', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/tui`;
    let ws: WSClient | null = null;
    let closed = false;

    await new Promise<void>((resolve) => {
      ws = new WSClient(wsUrl);
      ws.on('close', () => {
        closed = true;
        resolve();
      });
      ws.on('error', () => {}); // ignore errors

      ws.on('open', () => {
        // Fuzz: send ⇒ random binary messages of varying sizes (1 to 16384 bytes)
        const iterations = 500;
        for (let i = 0; i < iterations; i++) {
          if (ws?.readyState !== WSClient.OPEN) break;
          const size = randomInt(1, 16384);
          try {
            const buf = randomBytes(size);
            ws.send(buf);
          } catch {
            break;
          }
        }
        // Close after fuzz (if still open)
        if (ws?.readyState === WSClient.OPEN) {
          ws.close();
        } else {
          // if already closed, resolve already queued
        }
      });
    });

    // After the connection lifecycle, verify server still responds to HTTP
    const metricsRes = await fetch(`http://127.0.0.1:${port}/metrics`);
    expect(metricsRes.status).toBe(200);
    const metrics = await metricsRes.json();
    expect(metrics).toHaveProperty('activeConnections');
    expect(metrics).toHaveProperty('totalConnections');
    // Also attempt a new WebSocket connection to ensure server accepts new connections
    const newWs = new WSClient(wsUrl);
    await new Promise((resolve) => newWs.once('open', resolve));
    newWs.close();
  });

  it('should handle a single large payload (1MB) without crashing', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/tui`;
    let ws: WSClient | null = null;

    await new Promise<void>((resolve) => {
      ws = new WSClient(wsUrl);
      ws.on('error', () => {});
      ws.on('close', () => resolve());

      ws.on('open', () => {
        // Send 1MB random data
        const largeBuf = randomBytes(1024 * 1024);
        try {
          ws.send(largeBuf);
        } catch {}
        // Close after a short delay to allow processing
        setTimeout(() => {
          if (ws?.readyState === WSClient.OPEN) {
            ws.close();
          } else {
            resolve();
          }
        }, 200);
      });
    });

    // Verify server still healthy
    const metricsRes = await fetch(`http://127.0.0.1:${port}/metrics`);
    expect(metricsRes.status).toBe(200);
    // Also attempt new connection
    const newWs = new WSClient(wsUrl);
    await new Promise((resolve) => newWs.once('open', resolve));
    newWs.close();
  });
});
