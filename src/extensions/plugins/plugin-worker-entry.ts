import { parentPort, workerData } from 'node:worker_threads';
import type { PluginMessage, RpcRequest } from './plugin-protocol.js';

type ExtensionModule = any;

// Forward declarations
interface MainClient {
  invoke(method: string, params: any): Promise<any>;
  send(event: string, payload?: any): void;
  getFlag(name: string): any;
  registerFlag(name: string, options: any): void;
}

interface WorkerApi {
  registerTool: (tool: any) => void;
  registerCommand: (name: string, cmd: any) => void;
  registerMessageRenderer: (customType: string, renderer: any) => void;
  registerHook: (event: string, handler: any) => void;
  registerWidget: (key: string, content: any, options?: any) => void;
  registerShortcut: (shortcut: string, options: any) => void;
  registerFlag: (name: string, options: any) => void;
  getFlag: (name: string) => any;
  on: (event: string, handler: any) => () => void;
  off: (event: string, handler: any) => void;
  sendMessage: (message: any, options?: any) => void;
}

class MainClientImpl implements MainClient {
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout?: NodeJS.Timeout }>();
  private nextId = 0;

  constructor() {
    if (!parentPort) throw new Error('MainClient can only be used in a worker');
    parentPort.on('message', (msg: PluginMessage) => this.handleMessage(msg));
  }

  private handleMessage(msg: PluginMessage) {
    if (msg.type === 'response') {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
        if (pending.timeout) clearTimeout(pending.timeout);
        this.pendingRequests.delete(msg.id);
      }
    } else if (msg.type === 'event') {
      // Events from main to worker (e.g., forwarded agent events)
      // Not implemented here; workers subscribe via on() which sets up a different channel
    }
  }

  async invoke(method: string, params: any): Promise<any> {
    const id = String(this.nextId++);
    const request: RpcRequest = { type: 'request', id, method, params };
    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout | undefined;
      // Default timeout 30s for RPC calls
      timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC call timed out after 30000ms`));
      }, 30000);
      this.pendingRequests.set(id, { resolve, reject, timeout });
      parentPort!.postMessage(request);
    });
  }

  send(event: string, payload?: any) {
    // For sending events from worker to main (e.g., custom messages)
    parentPort?.postMessage({ type: 'event', event, payload } as any);
  }

  getFlag(name: string): any {
    // Synchronous flags are sent via a special request
    // For simplicity, we'll treat as async invoke
    return this.invoke('get_flag', { name }).catch(() => undefined);
  }

  registerFlag(name: string, options: any) {
    this.invoke('register_flag', { name, options }).catch(console.error);
  }
}

// Main client singleton (lazy)
let mainClient: MainClient | null = null;
function getMainClient(): MainClient {
  if (!mainClient) mainClient = new MainClientImpl();
  return mainClient;
}

// Event subscription helpers
type EventHandler = (payload?: any) => void;
const eventHandlers = new Map<string, Set<EventHandler>>();

function subscribe(event: string, handler: EventHandler) {
  let set = eventHandlers.get(event);
  if (!set) {
    set = new Set();
    eventHandlers.set(event, set);
  }
  set.add(handler);
  // Also subscribe on main if not already
  mainClient?.invoke('subscribe_hook', { event }).catch(() => {});
}

function unsubscribe(event: string, handler: EventHandler) {
  const set = eventHandlers.get(event);
  if (set) {
    set.delete(handler);
    if (set.size === 0) {
      mainClient?.invoke('unsubscribe_hook', { event }).catch(() => {});
    }
  }
}

// Main API provided to extensions
const workerApi: WorkerApi = {
  registerTool: (tool: any) => {
    toolRegistry.set(tool.name, tool);
    // Notify main about new tool (registration happens via main side)
    getMainClient().invoke('register_tool', { tool }).catch(console.error);
  },
  registerCommand: (name: string, cmd: any) => {
    commandRegistry.set(name, cmd);
    getMainClient().invoke('register_command', { name, command: cmd }).catch(console.error);
  },
  registerMessageRenderer: (customType: string, renderer: any) => {
    rendererRegistry.set(customType, renderer);
    getMainClient().invoke('register_renderer', { customType, renderer }).catch(console.error);
  },
  registerHook: (event: string, handler: any) => {
    let handlers = hookRegistry.get(event);
    if (!handlers) {
      handlers = new Set();
      hookRegistry.set(event, handlers);
    }
    handlers.add(handler);
    // Subscribe on main so we get forwarded events
    subscribe(event, handler);
  },
  registerWidget: (key: string, content: any, options?: any) => {
    // Widgets are registered directly via main API (setWidget)
    // Content can be string[] or factory function
    getMainClient().invoke('register_widget', { key, content, options }).catch(console.error);
  },
  registerShortcut: (shortcut: string, options: any) => {
    getMainClient().invoke('register_shortcut', { shortcut, options }).catch(console.error);
  },
  registerFlag: (name: string, options: any) => {
    getMainClient().invoke('register_flag', { name, options }).catch(console.error);
  },
  getFlag: (name: string) => getMainClient().getFlag(name),
  on: (event: string, handler: any) => {
    subscribe(event, handler);
    return () => unsubscribe(event, handler);
  },
  off: (event: string, handler: any) => {
    unsubscribe(event, handler);
  },
  sendMessage: (message: any, options?: any) => {
    getMainClient().send('send_message', { message, options });
  },
};

// Registries
const toolRegistry = new Map<string, any>();
const commandRegistry = new Map<string, any>();
const rendererRegistry = new Map<string, any>();
const hookRegistry = new Map<string, Set<any>>();
// widgetRegistry not needed; registration is forwarded

(async () => {
  const { modulePath, entryName } = workerData as { modulePath: string; entryName?: string };
  let extModule: ExtensionModule;
  try {
    extModule = await import(modulePath);
  } catch (e: any) {
    parentPort?.postMessage({ type: 'event', event: 'error', payload: e.message } as any);
    process.exit(1);
    return;
  }

  // Determine which function to call for registration
  let entryFn: any;
  if (entryName) {
    entryFn = extModule[entryName];
    if (typeof entryFn !== 'function') {
      console.error(`Entry function '${entryName}' not found or not a function in module`);
      process.exit(1);
      return;
    }
  } else {
    entryFn = extModule.default ?? extModule.register;
    if (typeof entryFn !== 'function') {
      console.error('Extension module has no default or register export');
      process.exit(1);
      return;
    }
  }

  try {
    await entryFn(workerApi);
    // Signal ready to main
    parentPort?.postMessage({ type: 'event', event: 'ready' } as any);
  } catch (e: any) {
    parentPort?.postMessage({ type: 'event', event: 'error', payload: e.message } as any);
    process.exit(1);
    return;
  }

  // RPC handler for main thread requests
  parentPort?.on('message', async (msg: PluginMessage) => {
    if (msg.type !== 'request') return;
    const { id, method, params } = msg as RpcRequest;
    try {
      let result: any;
      switch (method) {
        case 'execute_tool': {
          const { toolName, toolCallId, ctx } = params as any;
          const tool = toolRegistry.get(toolName);
          if (!tool) throw new Error(`Tool ${toolName} not found`);
          const onUpdate = (update: any) => {
            parentPort?.postMessage({ type: 'event', event: 'tool_update', toolCallId, update } as any);
          };
          // params (outer) contains the tool parameters
          result = await tool.execute(toolCallId, params, undefined, onUpdate, ctx);
          break;
        }
        case 'execute_command': {
          const { commandName, ctx } = params as any;
          const command = commandRegistry.get(commandName);
          if (!command) throw new Error(`Command ${commandName} not found`);
          // params (outer) contains command arguments
          result = await command.execute(params, ctx);
          break;
        }
        case 'render_message': {
          const { customType, message, options, theme } = params as any;
          const renderer = rendererRegistry.get(customType);
          if (!renderer) throw new Error(`Renderer for ${customType} not found`);
          result = renderer(message, options, theme);
          break;
        }
        case 'invoke_hook': {
          const { hookEvent, hookParams, ctx } = params as any;
          const handlers = hookRegistry.get(hookEvent);
          if (!handlers || handlers.size === 0) {
            result = undefined;
          } else {
            // Invoke all handlers sequentially; collect results? For simplicity, last wins or ignore results.
            for (const handler of handlers) {
              try {
                const res = await handler(hookParams, ctx);
                // Hooks generally don't return meaningful results; ignore
              } catch (err) {
                console.error(`Hook error for event ${hookEvent}:`, err);
              }
            }
            result = undefined;
          }
          break;
        }
        case 'ctx_call': {
          // Worker requests a call on the provided context object (e.g., ui.notify)
          // params: { ctxId: string, method: string, args: any[] }
          const { ctxId, method, args } = params as any;
          // Forward to main
          result = await getMainClient().invoke('ctx_call', { ctxId, method, args });
          break;
        }
        default:
          throw new Error(`Unknown method: ${method}`);
      }
      const response: any = { type: 'response', id, result };
      parentPort?.postMessage(response);
    } catch (err: any) {
      const response: any = { type: 'response', id, error: err.message };
      parentPort?.postMessage(response);
    }
  });

  // Also listen for forwarded events from main (e.g., turn_start, tool_result, etc.)
  parentPort?.on('message', (msg: PluginMessage) => {
    if (msg.type === 'event' && msg.event.startsWith('forwarded_')) {
      const originalEvent = msg.event.slice('forwarded_'.length);
      const handlers = eventHandlers.get(originalEvent);
      if (handlers) {
        for (const h of handlers) {
          try {
            h(msg.payload);
          } catch (err) {
            console.error(`Event handler error for ${originalEvent}:`, err);
          }
        }
      }
    }
  });
})().catch((e) => {
  console.error('Plugin worker fatal error:', e);
  process.exit(1);
});
