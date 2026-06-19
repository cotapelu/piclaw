import { PluginWorker } from './plugin-worker.js';

/**
 * Manages lifecycle of plugin workers.
 */
export class PluginManager {
  private workers = new Map<string, PluginWorker>();

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
    // In development, the entry might be a .ts file; we rely on node to run compiled .js. For simplicity, use .js extension.
    // For tests, Worker can be mocked so entry path is irrelevant.
    const worker = new PluginWorker(entry, { modulePath });
    this.workers.set(extensionName, worker);
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
}
