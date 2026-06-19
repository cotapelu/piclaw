import { Worker } from 'node:worker_threads';
import type { PluginMessage, RpcRequest, RpcResponse } from './plugin-protocol.js';

/**
 * Manages a single plugin worker thread.
 */
export class PluginWorker {
  private worker: Worker;
  private pending = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void; timer?: NodeJS.Timeout }>();
  private nextId = 0;
  private terminated = false;

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
        if (pending.timer) clearTimeout(pending.timer);
        if (error) pending.reject(new Error(error));
        else pending.resolve(result);
        this.pending.delete(id);
      }
    }
    // ignore other message types
  }

  private handleError(err: Error): void {
    this.rejectAll(err);
  }

  private handleExit(code: number | null): void {
    if (code !== 0 && !this.terminated) {
      const err = new Error(`Plugin worker exited with code ${code}`);
      this.rejectAll(err);
    }
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
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      if (timeoutMs) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`Plugin invocation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker.postMessage(request);
      } catch (e) {
        if (timer) clearTimeout(timer);
        this.pending.delete(id);
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
    // Simplified: if we have explicitly terminated, not alive. Worker crash also handled via error/exit.
    return !this.terminated;
  }
}
