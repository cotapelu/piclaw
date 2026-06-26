#!/usr/bin/env node
/**
 * WebSocket TUI Server
 *
 * Starts an HTTP server that serves an xterm.js-based terminal client and upgrades
 * connections to WebSocket to provide a remote TUI experience.
 *
 * Each WebSocket connection spawns a new piclaw CLI process attached to a PTY.
 */

import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import pty from 'node-pty';
import type { IPty } from 'node-pty';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server as HttpServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadConfig } from './config/config-manager.js';
import { cleanupOldMetrics } from './utils/metrics-retention.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface StartOptions {
  port: number;
  address: string;
  token: string | null;
  cliArgs: string[];
  cwd: string;
}

export interface WebSocketServerMetrics {
  activeConnections: number;
  totalConnections: number;
  totalErrors: number;
  totalPtySpawned: number;
  startTime: Date;
  uptimeSeconds: number;
}

export class WebSocketMetrics {
  private activeConnections = 0;
  private totalConnections = 0;
  private totalErrors = 0;
  private totalPtySpawned = 0;
  private readonly startTime = new Date();

  incConnection() {
    this.activeConnections++;
    this.totalConnections++;
  }

  decConnection() {
    if (this.activeConnections > 0) this.activeConnections--;
  }

  incError() {
    this.totalErrors++;
  }

  incPtySpawned() {
    this.totalPtySpawned++;
  }

  getSnapshot(): WebSocketServerMetrics {
    return {
      activeConnections: this.activeConnections,
      totalConnections: this.totalConnections,
      totalErrors: this.totalErrors,
      totalPtySpawned: this.totalPtySpawned,
      startTime: new Date(this.startTime),
      uptimeSeconds: (Date.now() - this.startTime.getTime()) / 1000,
    };
  }
}

// Global metrics instance (per server instance)
let serverMetrics: WebSocketMetrics | null = null;

/**
 * Embedded HTML client using xterm.js
 * Served at the root path.
 */
const HTML_CLIENT = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>PiClaw Remote TUI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css"/>
  <style>
    body { margin: 0; padding: 0; height: 100vh; display: flex; justify-content: center; align-items: center; background: #1e1e1e; }
    #terminal { width: 100%; height: 100%; padding: 10px; box-sizing: border-box; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
  <script>
    const term = new Terminal();
    term.open(document.getElementById('terminal'));
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = protocol + '://' + window.location.host + '/tui';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        ws.send(token);
      }
    };

    ws.onmessage = (e) => term.write(e.data);
    term.onData((data) => ws.send(data));
    term.onResize(({ cols, rows }) => {
      try {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      } catch (err) {}
    });
    ws.onclose = () => term.write('\\r\\nConnection closed.\\r\\n');
    ws.onerror = () => term.write('\\r\\nWebSocket error.\\r\\n');
  </script>
</body>
</html>` as string;

/**
 * Parse arguments to extract WebSocket TUI flags.
 *
 * Recognized flags (removed from output):
 *   --tui-websocket[=port]   Enable WebSocket TUI on given port (default 8080)
 *   --tui-port=port          Alias for port
 *   --tui-address=addr       Bind address (default 127.0.0.1)
 *   --tui-token=secret       Token required for client auth
 *
 * Returns:
 *   {
 *     enabled: boolean,
 *     port: number,
 *     address: string,
 *     token: string | null,
 *     remainingArgs: string[]
 *   }
 */
export function parseWebsocketArgs(args: string[]): {
  enabled: boolean;
  port: number;
  address: string;
  token: string | null;
  remainingArgs: string[];
} {
  const result = {
    enabled: false,
    port: 8080,
    address: '127.0.0.1',
    token: null as string | null,
    remainingArgs: [] as string[],
  };
  let enabled = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tui-websocket') {
      enabled = true;
      continue;
    }
    if (arg.startsWith('--tui-websocket=')) {
      enabled = true;
      const portStr = arg.slice('--tui-websocket='.length);
      const port = parseInt(portStr, 10);
      if (!isNaN(port) && port > 0 && port < 65536) {
        result.port = port;
      }
      continue;
    }
    if (arg.startsWith('--tui-port=')) {
      enabled = true;
      const portStr = arg.slice('--tui-port='.length);
      const port = parseInt(portStr, 10);
      if (!isNaN(port) && port > 0 && port < 65536) {
        result.port = port;
      }
      continue;
    }
    if (arg.startsWith('--tui-address=')) {
      enabled = true;
      result.address = arg.slice('--tui-address='.length);
      continue;
    }
    if (arg.startsWith('--tui-token=')) {
      enabled = true;
      result.token = arg.slice('--tui-token='.length);
      continue;
    }
    result.remainingArgs.push(arg);
  }

  return { ...result, enabled };
}

/**
 * Get the current server metrics if the server is running.
 * Returns null if the server hasn't been started.
 */
export function getWebSocketServerMetrics(): WebSocketServerMetrics | null {
  return serverMetrics ? serverMetrics.getSnapshot() : null;
}

/**
 * Starts the WebSocket TUI server.
 *
 * @param options Server configuration
 * @returns A stop handle to gracefully shut down the server
 */
export function startWebsocketTuiServer(options: StartOptions): { stop: () => void; server: HttpServer } {
  const httpServer: HttpServer = createServer(async (req, res) => {
    const url = req.url || '/';
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(HTML_CLIENT);
      return;
    }
    if (url === '/metrics') {
      if (serverMetrics) {
        const snapshot = serverMetrics.getSnapshot();
        const payload = {
          ...snapshot,
          startTime: snapshot.startTime.toISOString(),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Metrics not available' }));
      }
      return;
    }
    if (url === '/prometheus-metrics') {
      if (serverMetrics) {
        const m = serverMetrics.getSnapshot();
        const lines = [
          '# HELP piclaw_websocket_active_connections Number of active WebSocket connections',
          '# TYPE piclaw_websocket_active_connections gauge',
          `piclaw_websocket_active_connections ${m.activeConnections}`,
          '# HELP piclaw_websocket_total_connections Total number of WebSocket connections accepted',
          '# TYPE piclaw_websocket_total_connections counter',
          `piclaw_websocket_total_connections ${m.totalConnections}`,
          '# HELP piclaw_websocket_total_errors Total number of errors encountered',
          '# TYPE piclaw_websocket_total_errors counter',
          `piclaw_websocket_total_errors ${m.totalErrors}`,
          '# HELP piclaw_websocket_pty_spawned Total number of PTY processes spawned',
          '# TYPE piclaw_websocket_pty_spawned counter',
          `piclaw_websocket_pty_spawned ${m.totalPtySpawned}`,
          '# HELP piclaw_websocket_uptime_seconds Server uptime in seconds',
          '# TYPE piclaw_websocket_uptime_seconds gauge',
          `piclaw_websocket_uptime_seconds ${m.uptimeSeconds.toFixed(6)}`,
        ];
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(lines.join('\n'));
      } else {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('# Metrics not available\n');
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/tui' });

  // Initialize metrics collector
  serverMetrics = new WebSocketMetrics();

  // Track PTY processes per WebSocket
  const ptyProcesses = new Map<WebSocket, IPty>();

  wss.on('connection', (ws: WebSocket, req) => {
    serverMetrics!.incConnection();

    // Token authentication: expect first message to be the token if required
    const authenticate = (): Promise<boolean> => {
      if (!options.token) return Promise.resolve(true);
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.removeListener('message', onMessage);
          ws.close(1008, 'Token timeout');
          serverMetrics!.incError();
          resolve(false);
        }, 5000);

        function onMessage(msg: unknown) {
          clearTimeout(timeout);
          ws.removeListener('message', onMessage);
          const received = (typeof msg === 'string')
            ? msg
            : Buffer.isBuffer(msg)
              ? msg.toString('utf8')
              : String(msg);
          if (received === options.token) {
            resolve(true);
          } else {
            ws.close(1008, 'Invalid token');
            serverMetrics!.incError();
            resolve(false);
          }
        }
        ws.on('message', onMessage);
      });
    };

    authenticate().then((ok) => {
      if (!ok) return;
      spawnPty(ws);
    });

    function spawnPty(ws: WebSocket) {
      const cols = 80;
      const rows = 24;
      const ptyProcess = pty.spawn('node', ['dist/cli.js', ...options.cliArgs], {
        name: 'xterm-color',
        cols,
        rows,
        cwd: options.cwd,
        env: process.env as NodeJS.ProcessEnv,
      });

      serverMetrics!.incPtySpawned();
      ptyProcesses.set(ws, ptyProcess);

      ptyProcess.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        ptyProcesses.delete(ws);
        serverMetrics!.decConnection();
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, `Process exited with code ${exitCode}`);
        }
      });

      ws.on('message', (msg) => {
        if (typeof msg === 'string' || Buffer.isBuffer(msg)) {
          // Try to parse as JSON for control messages (resize)
          try {
            const text = typeof msg === 'string' ? msg : msg.toString('utf8');
            const obj = JSON.parse(text);
            if (obj.type === 'resize' && typeof obj.cols === 'number' && typeof obj.rows === 'number') {
              ptyProcess.resize(obj.cols, obj.rows);
              return;
            }
          } catch {
            // Not JSON; treat as stdin input
          }
          const input = typeof msg === 'string' ? msg : msg.toString();
          ptyProcess.write(input);
        }
      });

      const cleanup = () => {
        ptyProcess.kill();
        ptyProcesses.delete(ws);
        serverMetrics!.decConnection();
      };
      ws.on('close', cleanup);
      ws.on('error', cleanup);
      ws.on('end', cleanup);
    }
  });

  httpServer.on('error', (err) => {
    console.error('WebSocket TUI server error:', err);
    serverMetrics!.incError();
  });

  httpServer.listen(options.port, options.address, () => {
    console.log(`WebSocket TUI server listening at http://${options.address}:${options.port}/`);
    if (options.token) {
      console.log(`Token authentication is enabled. Append ?token=${options.token} to the URL.`);
    }
  });

  // Optional: persist metrics to daily file for historical analysis
  let intervalId: any = null;
  try {
    const config = loadConfig();
    const retentionDays = config.metricsRetentionDays ?? 30;
    const metricsDir = join(process.cwd(), '.piclaw');
    intervalId = setInterval(async () => {
      try {
        if (!serverMetrics) return;
        const snapshot = serverMetrics.getSnapshot();
        const entry = {
          timestamp: new Date().toISOString(),
          ...snapshot,
          startTime: snapshot.startTime.toISOString(),
        };
        await mkdir(metricsDir, { recursive: true });
        const dateStr = new Date().toISOString().slice(0, 10);
        const filePath = join(metricsDir, `websocket-metrics-${dateStr}.json`);
        const existing: any[] = [];
        try {
          const data = await readFile(filePath, 'utf-8');
          existing.push(JSON.parse(data));
        } catch {}
        existing.push(entry);
        await writeFile(filePath, JSON.stringify(existing, null, 2));
        // cleanup old files based on retention
        try {
          await cleanupOldMetrics(metricsDir, retentionDays);
        } catch (e) {
          console.error('WebSocket metrics cleanup error:', e);
        }
      } catch (e) {
        console.error('Failed to write WebSocket metrics:', e);
      }
    }, 10000); // every 10 seconds
  } catch (e) {
    // config load may fail; ignore persistence
    console.error('Failed to initialize WebSocket metrics persistence:', e);
  }

  return {
    stop: () => {
      if (intervalId) clearInterval(intervalId);
      wss.clients.forEach((client) => {
        client.terminate();
        const proc = ptyProcesses.get(client);
        if (proc) {
          proc.kill();
        }
      });
      ptyProcesses.clear();
      httpServer.close();
    },
    server: httpServer,
  };
}
