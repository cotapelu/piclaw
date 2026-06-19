import { parentPort, workerData } from 'node:worker_threads';
import type { PluginMessage, RpcRequest } from './plugin-protocol.js';

type ExtensionModule = any;

interface WorkerApi {
  registerTool: (tool: any) => void;
  registerCommand: (name: string, cmd: any) => void;
  registerRenderer: (rend: any) => void;
  registerHook: (hook: any) => void;
  registerWidget: (widget: any) => void;
}

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

  // Registries
  const toolRegistry = new Map<string, any>();
  const commandRegistry = new Map<string, any>();
  // rendererRegistry, etc. could be added similarly

  // API provided to the extension
  const workerApi: WorkerApi = {
    registerTool: (tool: any) => {
      toolRegistry.set(tool.name, tool);
      parentPort?.postMessage({ type: 'register_tool', tool } as any);
    },
    registerCommand: (name: string, cmd: any) => {
      commandRegistry.set(name, cmd);
      parentPort?.postMessage({ type: 'register_command', name, command: cmd } as any);
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
      if (method === 'execute_tool') {
        const { toolName, toolCallId, params: toolParams, ctx } = params as any;
        const tool = toolRegistry.get(toolName);
        if (!tool) throw new Error(`Tool ${toolName} not found`);
        const onUpdate = (update: any) => {
          parentPort?.postMessage({ type: 'tool_update', toolCallId, update } as any);
        };
        result = await tool.execute(toolCallId, toolParams, undefined, onUpdate, ctx);
      } else if (method === 'execute_command') {
        const { commandName, params: cmdParams, ctx } = params as any;
        const command = commandRegistry.get(commandName);
        if (!command) throw new Error(`Command ${commandName} not found`);
        // Commands typically have execute(params, ctx) signature
        result = await command.execute(cmdParams, ctx);
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
