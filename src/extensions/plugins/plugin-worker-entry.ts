import { parentPort, workerData } from 'node:worker_threads';
import type { PluginMessage, RpcRequest, RpcResponse } from './plugin-protocol.js';

// The extension module should export functions (methods) directly.
interface ExtensionModule {
  [key: string]: (...args: any[]) => any | Promise<any>;
}

(async () => {
  const { modulePath } = workerData as { modulePath: string };
  let extModule: ExtensionModule;
  try {
    extModule = await import(modulePath) as ExtensionModule;
    parentPort?.postMessage({ type: 'event', event: 'ready' } as any);
  } catch (e: any) {
    parentPort?.postMessage({ type: 'event', event: 'error', payload: e.message } as any);
    // Still continue? Better to exit.
    process.exit(1);
    return;
  }

  parentPort?.on('message', async (msg: PluginMessage) => {
    if (msg.type !== 'request') return;
    const { id, method, params } = msg as RpcRequest;
    try {
      const fn = extModule[method];
      if (typeof fn !== 'function') {
        throw new Error(`Method '${method}' is not defined or not a function`);
      }
      const result = await fn(params);
      const response: RpcResponse = { type: 'response', id, result };
      parentPort?.postMessage(response);
    } catch (err: any) {
      const response: RpcResponse = { type: 'response', id, error: err.message };
      parentPort?.postMessage(response);
    }
  });
})().catch((e) => {
  // Log any unexpected errors
  console.error('Plugin worker fatal error:', e);
  process.exit(1);
});
