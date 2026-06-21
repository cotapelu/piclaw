import { Worker } from 'node:worker_threads';
import type { PluginMessage, RpcRequest, RpcResponse } from './plugin-protocol.js';

/**
 * Plugin worker metrics snapshot.
 */
export interface PluginWorkerMetrics {
  /** Worker start time (ms since epoch) */
  startTime: number;
  /** Current status */
  status: 'alive' | 'exited' | 'crashed';
  /** Exit code, if terminated */
  exitCode: number | null;
  /** Total requests sent to worker */
  requests: number;
  /** Total responses received from worker */
  responses: number;
  /** Total error responses or worker errors */
  errors: number;
  /** Most recent error message (if any) */
  lastError: string | null;
  /** Total accumulated RPC latency in ms */
  totalLatency: number;
  /** Number of completed RPC calls (for average) */
  latencyCount: number;
  /** Estimated average latency (ms) */
  avgLatency: number;
}

/**
 * Manages a single plugin worker thread with observability.
 */
export class PluginWorker {
  private worker: Worker;
  private pending = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void; timer?: NodeJS.Timeout; sentTime: number }>();
  private nextId = 0;
  private terminated = false;

  // Metrics
  private startTime = Date.now();
  private requests = 0;
  private responses = 0;
  private errors = 0;
  private lastError: string | null = null;
  private totalLatency = 0;
  private latencyCount = 0;
  private exitCode: number | null = null;

  constructor(entry: string, workerData?: any) {
    this.worker = new Worker(entry, { workerData });
    this.worker.on('message', (msg: PluginMessage) => this.handleMessage(msg));
    this.worker.on('error', (err: Error) => this.handleError(err));
    this.worker.on('exit', (code) => this.handleExit(code));
  }

  /** Expose the underlying Worker for external event attachment (e.g., PluginManager). */
  get underlying(): Worker {
    return this.worker;
  }

  private handleMessage(msg: PluginMessage): void {
    if (this.terminated) return;
    if (msg.type === 'response') {
      const { id, result, error } = msg as RpcResponse;
      const pending = this.pending.get(id);
      if (pending) {
        const latency = Date.now() - pending.sentTime;
        this.totalLatency += latency;
        this.latencyCount++;
        if (pending.timer) clearTimeout(pending.timer);
        if (error) {
          this.errors++;
          this.lastError = error;
          pending.reject(new Error(error));
        } else {
          pending.resolve(result);
        }
        this.pending.delete(id);
      }
      this.responses++;
    }
    // ignore other message types
  }

  private handleError(err: Error): void {
    this.errors++;
    this.lastError = err.message;
    this.rejectAll(err);
  }

  private handleExit(code: number | null): void {
    if (!this.terminated) {
      this.exitCode = code;
      if (code !== 0) {
        this.errors++;
        this.lastError = `Worker exited with code ${code}`;
      }
    }
    this.rejectAll(new Error(`Plugin worker terminated (exit code ${code})`));
  }

  private rejectAll(err: Error): void {
    this.pending.forEach(p => {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
    });
    this.pending.clear();
  }

  /**
   * Invoke a method on the plugin. Returns a promise that resolves with the result or rejects on error/timeout.
   * @param method - method name to call
   * @param params - optional parameters
   * @param timeoutMs - optional timeout in milliseconds
   */
  invoke(method: string, params?: any, timeoutMs?: number): Promise<any> {
    if (this.terminated) return Promise.reject(new Error('Plugin worker terminated'));
    const id = `${this.nextId++}`;
    const request: RpcRequest = { type: 'request', id, method, params };
    this.requests++; // increment immediately when sending
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      if (timeoutMs) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`Plugin invocation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.pending.set(id, { resolve, reject, timer, sentTime: Date.now() });
      try {
        this.worker.postMessage(request);
      } catch (e) {
        if (timer) clearTimeout(timer);
        this.pending.delete(id);
        this.errors++;
        this.lastError = (e as Error).message;
        reject(e);
      }
    });
  }

  /**
   * Gracefully terminate the worker.
   */
  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.worker.terminate();
    this.rejectAll(new Error('Plugin worker terminated'));
  }

  /**
   * Check if worker is still alive.
   */
  get alive(): boolean {
    return !this.terminated;
  }

  /**
   * Collect current metrics snapshot.
   */
  getMetrics(): PluginWorkerMetrics {
    return {
      startTime: this.startTime,
      status: this.terminated ? (this.exitCode === 0 ? 'exited' : 'crashed') : 'alive',
      exitCode: this.exitCode,
      requests: this.requests,
      responses: this.responses,
      errors: this.errors,
      lastError: this.lastError,
      totalLatency: this.totalLatency,
      latencyCount: this.latencyCount,
      avgLatency: this.latencyCount > 0 ? this.totalLatency / this.latencyCount : 0,
    };
  }
}
