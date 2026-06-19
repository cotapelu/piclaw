import { parentPort, workerData } from 'node:worker_threads';
import type { PluginMessage, RpcRequest } from './plugin-protocol.js';

// The extension module may export a default function or a named `register` function.
type ExtensionModule = any;

interface WorkerApi {
  registerTool: (tool: any) => void;
  registerCommand: (cmd: any) => void;
  registerRenderer: (rend: any) => void;
  registerHook: (hook: any) => void;
  registerWidget: (widget: any) => void;
}

(async () => {
  const { modulePath } = workerData as { modulePath: string };
  let extModule: ExtensionModule;
  try {
    extModule = await import(modulePath);
  } catch (e: any) {
    parentPort?.postMessage({ type: 'event', event: 'error', payload: e.message } as any);
    process.exit(1);
    return;
  }

  // Registries for tools and other extension components
  const toolRegistry = new Map<string, any>();
  // (commandRegistry, rendererRegistry, etc. could be added similarly)

  // The API object provided to the extension during registration
  const workerApi: WorkerApi = {
    registerTool: (tool: any) => {
      toolRegistry.set(tool.name, tool);
      parentPort?.postMessage({ type: 'register_tool', tool } as any);
    },
    registerCommand: (cmd: any) => {
      parentPort?.postMessage({ type: 'register_command', command: cmd } as any);
    },
    registerRenderer: (rend: any) => {
      parentPort?.postMessage({ type: 'register_renderer', renderer: rend } as any);
    },
    registerHook: (hook: any) => {
      parentPort?.postMessage({ type: 'register_hook', hook } as any);
    },
    registerWidget: (widget: any) => {
      parentPort?.postMessage({ type: 'register_widget', widget } as any);
    },
  };

  // Find registration function: prefer default export, else named 'register'
  const registerFn = extModule.default ?? extModule.register;
  if (typeof registerFn !== 'function') {
    console.error('Extension module has no default or register export');
    process.exit(1);
    return;
  }

  try {
    await registerFn(workerApi);
    parentPort?.postMessage({ type: 'event', event: 'ready' } as any);
  } catch (e: any) {
    parentPort?.postMessage({ type: 'event', event: 'error', payload: e.message } as any);
    process.exit(1);
    return;
  }

  // Handle RPC requests from main thread
  parentPort?.on('message', async (msg: PluginMessage) => {
    if (msg.type !== 'request') return;
    const { id, method, params } = msg as RpcRequest;
    try {
      let result: any;
      if (method === 'execute_tool') {
        const { toolName, toolCallId, params: toolParams, ctx } = params as any;
        const tool = toolRegistry.get(toolName);
        if (!tool) throw new Error(`Tool ${toolName} not found`);
        // onUpdate forwards to main asynchronously
        const onUpdate = (update: any) => {
          parentPort?.postMessage({ type: 'tool_update', toolCallId, update } as any);
        };
        // We ignore AbortSignal (params.signal) for now
        result = await tool.execute(toolCallId, toolParams, undefined, onUpdate, ctx);
      } else {
        throw new Error(`Unknown method: ${method}`);
      }
      const response: any = { type: 'response', id, result };
      parentPort?.postMessage(response);
    } catch (err: any) {
      const response: any = { type: 'response', id, error: err.message };
      parentPort?.postMessage(response);
    }
  });
})().catch((e) => {
  console.error('Plugin worker fatal error:', e);
  process.exit(1);
});
