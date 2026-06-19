import { PluginWorker } from './plugin-worker.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { PluginMessage } from './plugin-protocol.js';

/**
 * Manages lifecycle of plugin workers and integrates with main API.
 */
export class PluginManager {
  private workers = new Map<string, PluginWorker>();
  private mainApi?: ExtensionAPI;
  private toolCallOnUpdates = new Map<string, (update: any) => void>();

  constructor(mainApi?: ExtensionAPI) {
    this.mainApi = mainApi;
  }

  /**
   * Load an extension module in its own worker.
   * @param modulePath Absolute path to the extension module (compiled JS).
   * @param name Optional name; defaults to basename of modulePath.
   * @returns The extension name used.
   */
  async loadExtension(modulePath: string, name?: string): Promise<string> {
    const extensionName = name ?? this.getNameFromPath(modulePath);
    if (this.workers.has(extensionName)) {
      throw new Error(`Extension ${extensionName} is already loaded`);
    }
    // The generic worker entry that knows how to host a plugin. It will receive modulePath via workerData.
    const entry = new URL('./plugin-worker-entry.js', import.meta.url).pathname;
    const worker = new PluginWorker(entry, { modulePath });
    this.workers.set(extensionName, worker);
    if (this.mainApi) {
      // Attach message handler for registration and updates
      worker.underlying.on('message', (msg: PluginMessage) => this.handleWorkerMessage(extensionName, msg));
    }
    return extensionName;
  }

  /**
   * Unload an extension by name.
   */
  unloadExtension(name: string): void {
    const worker = this.workers.get(name);
    if (worker) {
      worker.terminate();
      this.workers.delete(name);
    }
  }

  /**
   * Get a PluginWorker for an extension.
   */
  getWorker(name: string): PluginWorker | undefined {
    return this.workers.get(name);
  }

  /**
   * List loaded extension names.
   */
  listExtensions(): string[] {
    return Array.from(this.workers.keys());
  }

  private getNameFromPath(path: string): string {
    const base = path.split('/').pop() ?? path;
    return base.replace(/\.[^.]*$/, ''); // strip extension
  }

  private handleWorkerMessage(extensionName: string, msg: any): void {
    if (!this.mainApi) return;

    if (msg.type === 'register_tool') {
      const tool = msg.tool as any;
      const worker = this.workers.get(extensionName)!;
      // Wrap tool.execute to proxy to worker
      const originalExecute = tool.execute;
      tool.execute = async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: (update: any) => void, ctx?: any) => {
        if (onUpdate) {
          this.toolCallOnUpdates.set(toolCallId, onUpdate);
        }
        try {
          const result = await worker.invoke('execute_tool', {
            toolName: tool.name,
            toolCallId,
            params,
            ctx,
          });
          return result;
        } finally {
          if (onUpdate) {
            this.toolCallOnUpdates.delete(toolCallId);
          }
        }
      };
      this.mainApi.registerTool(tool);
    } else if (msg.type === 'tool_update') {
      const { toolCallId, update } = msg as any;
      const onUpdate = this.toolCallOnUpdates.get(toolCallId);
      if (onUpdate) onUpdate(update);
    }
    // TODO: handle other registration types: register_command, register_renderer, etc.
  }
}
