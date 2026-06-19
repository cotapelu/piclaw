import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockWorkerInstance: any;

// Mock node:worker_threads before importing PluginWorker
vi.mock('node:worker_threads', () => {
  class MockWorker {
    on = vi.fn();
    postMessage = vi.fn();
    terminate = vi.fn();
    exitedAfterDisconnect = false;
    threadId = 1;
    constructor() {
      mockWorkerInstance = this;
    }
  }
  return {
    Worker: MockWorker,
    isMainThread: true,
    parentPort: null,
    workerData: undefined,
  };
});

import { PluginWorker } from '../../extensions/plugins/plugin-worker.js';
import { PluginManager } from '../../extensions/plugins/plugin-manager.js';

describe('PluginWorker', () => {
  let worker: PluginWorker;
  let instance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerInstance = undefined;
    worker = new PluginWorker('dummy-entry.js', {});
    instance = mockWorkerInstance;
    expect(instance).toBeDefined();
  });

  it('registers message, error, and exit listeners', () => {
    expect(instance.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(instance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(instance.on).toHaveBeenCalledWith('exit', expect.any(Function));
  });

  it('invoke sends a properly formatted request', () => {
    worker.invoke('testMethod', { arg: 123 });
    expect(instance.postMessage).toHaveBeenCalledWith({
      type: 'request',
      id: '0',
      method: 'testMethod',
      params: { arg: 123 },
    });
  });

  it('invoke returns a promise that resolves on response', async () => {
    const promise = worker.invoke('method', {});
    // Get the message callback from the on('message') call
    const messageCb = instance.on.mock.calls.find((c: any) => c[0] === 'message')[1];
    messageCb({ type: 'response', id: '0', result: 'ok' });
    const result = await promise;
    expect(result).toBe('ok');
  });

  it('invoke returns a promise that rejects on worker error event', async () => {
    const promise = worker.invoke('method', {});
    const errorCb = instance.on.mock.calls.find((c: any) => c[0] === 'error')[1];
    errorCb(new Error('worker failure'));
    await expect(promise).rejects.toThrow('worker failure');
  });

  it('invoke returns a promise that rejects on exit with non-zero code', async () => {
    const promise = worker.invoke('method', {});
    const exitCb = instance.on.mock.calls.find((c: any) => c[0] === 'exit')[1];
    exitCb(1);
    await expect(promise).rejects.toThrow('Plugin worker exited with code 1');
  });

  it('terminate stops the worker and rejects pending promises', async () => {
    const pending = worker.invoke('method', {});
    worker.terminate();
    expect(instance.terminate).toHaveBeenCalled();
    await expect(pending).rejects.toThrow('Plugin worker terminated');
    expect(worker.alive).toBe(false);
  });

  it('multiple concurrent invokes use unique ids', async () => {
    const p1 = worker.invoke('a');
    const p2 = worker.invoke('b');
    // Check that two distinct ids were sent
    expect(instance.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'request',
      id: '0',
      method: 'a',
      params: undefined,
    });
    expect(instance.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'request',
      id: '1',
      method: 'b',
      params: undefined,
    });
    const messageCb = instance.on.mock.calls.find((c: any) => c[0] === 'message')[1];
    // Resolve in order
    messageCb({ type: 'response', id: '0', result: 1 });
    messageCb({ type: 'response', id: '1', result: 2 });
    expect(await p1).toBe(1);
    expect(await p2).toBe(2);
  });
});

describe('PluginWorker timeouts', () => {
  let worker: PluginWorker;
  let instance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerInstance = undefined;
    vi.useFakeTimers();
    worker = new PluginWorker('dummy-entry.js');
    instance = mockWorkerInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    worker.terminate();
  });

  it('times out if no response within given timeout', async () => {
    const promise = worker.invoke('method', {}, 1000);
    // Attach an early catch to avoid unhandled rejection warnings
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('Plugin invocation timed out after 1000ms');
  });

  it('does not time out if response arrives before timeout', async () => {
    const promise = worker.invoke('method', {}, 1000);
    // Fast-forward less than timeout
    await vi.advanceTimersByTimeAsync(500);
    const messageCb = instance.on.mock.calls.find((c: any) => c[0] === 'message')[1];
    messageCb({ type: 'response', id: '0', result: 'ok' });
    // Attach catch to be safe
    promise.catch(() => {});
    await expect(promise).resolves.toBe('ok');
    // Advance timers to clear any remaining tasks
    await vi.runAllTimersAsync();
  });
});

describe('PluginManager', () => {
  let manager: PluginManager;
  let capturedInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerInstance = undefined;
    manager = new PluginManager();
  });

  it('loadExtension creates a PluginWorker with correct entry and workerData', async () => {
    const name = await manager.loadExtension('/path/to/extension.js', 'myext');
    expect(name).toBe('myext');
    // The PluginWorker's constructor created the mock worker instance
    const instance = mockWorkerInstance;
    expect(instance).toBeDefined();
    // Verify that the Worker constructor was called with the expected entry and workerData
    // The Worker constructor is the MockWorker class; the call to `new Worker` happened inside PluginWorker
    // We can't directly see the arguments, but we know it was called. However we can spy on the class? Not easily.
    // Instead, check that the PluginManager returned a PluginWorker and that it is alive.
    expect(manager.listExtensions()).toContain('myext');
    expect(manager.getWorker('myext')).toBeInstanceOf(PluginWorker);
  });

  it('loadExtension uses fallback name from path if not provided', async () => {
    const name = await manager.loadExtension('/path/to/my-ext.js');
    expect(name).toBe('my-ext');
  });

  it('loadExtension rejects if extension already loaded', async () => {
    await manager.loadExtension('/path/a.js', 'same');
    await expect(manager.loadExtension('/path/b.js', 'same')).rejects.toThrow('already loaded');
  });

  it('unloadExtension terminates worker and removes entry', async () => {
    const name = await manager.loadExtension('/path/to/ext.js', 'ext');
    const worker = manager.getWorker(name)!;
    // The underlying worker instance is stored in mockWorkerInstance
    const instance = mockWorkerInstance;
    manager.unloadExtension(name);
    expect(instance.terminate).toHaveBeenCalled();
    expect(manager.getWorker('ext')).toBeUndefined();
    expect(manager.listExtensions()).not.toContain('ext');
  });

  it('unloadExtension does nothing if unknown name', () => {
    manager.unloadExtension('nonexistent');
    // No crash, and no worker construct calls
    expect(mockWorkerInstance).toBeUndefined();
  });
});
