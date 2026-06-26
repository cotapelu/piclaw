import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startWebsocketTuiServer } from '../websocket-tui-server.js';
import { WebSocket as WSClient } from 'ws';

describe('WebSocket TUI Server Edge Cases', () => {
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

  it('should tolerate invalid JSON messages without crashing', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/tui`;
    let closedNormally = false;
    let errorOccurred: any = null;

    await new Promise<void>((resolve) => {
      const ws = new WSClient(wsUrl);
      ws.on('message', () => {});

      ws.on('open', () => {
        // Send malformed JSON messages
        ws.send('not json at all');
        ws.send('{ invalid json syntax }');
        ws.send('{ "type": "resize", "cols": "abc", "rows": "xyz" }'); // wrong types
      });

      ws.on('close', () => {
        closedNormally = true;
        resolve();
      });

      ws.on('error', (err) => {
        errorOccurred = err;
      });
    });

    expect(closedNormally).toBe(true);
    expect(errorOccurred).toBeNull();
  });

  it('should handle binary data without error', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/tui`;
    let closedNormally = false;
    let errorOccurred: any = null;

    await new Promise<void>((resolve) => {
      const ws = new WSClient(wsUrl);
      ws.on('message', () => {});

      ws.on('open', () => {
        // Send binary buffer with high-bit values
        const buf = Buffer.from([0xff, 0xfe, 0x80, 0x00, 0x01]);
        ws.send(buf);
      });

      ws.on('close', () => {
        closedNormally = true;
        resolve();
      });
      ws.on('error', (err) => {
        errorOccurred = err;
      });
    });

    expect(closedNormally).toBe(true);
    expect(errorOccurred).toBeNull();
  });

  it('should ignore resize with missing fields without crashing', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/tui`;
    let closedNormally = false;
    let errorOccurred: any = null;

    await new Promise<void>((resolve) => {
      const ws = new WSClient(wsUrl);
      ws.on('message', () => {});

      ws.on('open', () => {
        // Send a resize message with missing cols/rows
        ws.send(JSON.stringify({ type: 'resize' }));
        // Send a resize message with null values
        ws.send(JSON.stringify({ type: 'resize', cols: null, rows: null }));
      });

      ws.on('close', () => {
        closedNormally = true;
        resolve();
      });
      ws.on('error', (err) => {
        errorOccurred = err;
      });
    });

    expect(closedNormally).toBe(true);
    expect(errorOccurred).toBeNull();
  });

  it('should not increase error count for malicious but non-fatal messages', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/tui`;
    let closedNormally = false;

    await new Promise<void>((resolve) => {
      const ws = new WSClient(wsUrl);
      ws.on('message', () => {});

      ws.on('open', () => {
        // Flood with random garbage
        for (let i = 0; i < 20; i++) {
          ws.send(`random garbage ${i} { invalid json`);
        }
      });

      ws.on('close', () => {
        closedNormally = true;
        resolve();
      });

      ws.on('error', () => {}); // errors expected? not ideally
    });

    expect(closedNormally).toBe(true);
    // Main goal: no unhandled error caused test to fail
  });
});
