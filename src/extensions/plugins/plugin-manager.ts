import { PluginWorker } from './plugin-worker.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { PluginMessage } from './plugin-protocol.js';
import { descriptorToComponent } from './component-serializer.js';
import { TeamManager, getDefaultTeamManager } from '../team/team-manager.js';

/**
 * Manages lifecycle of plugin workers and integrates with main API.
 *
 * Supports:
 * - Tool/command registration with context bridging
 * - Hook (event) subscription and forwarding
 * - Context RPC (ctx_call) for workers to call back into main thread context methods
 * - Flag/getFlag passthrough
 * - Message sending via sendMessage
 */
export class PluginManager {
  private workers = new Map<string, PluginWorker>();
  private mainApi?: ExtensionAPI;
  private toolCallOnUpdates = new Map<string, (update: any) => void>();
  private commandWorkers = new Map<string, PluginWorker>();
  private rendererWorkers = new Map<string, PluginWorker>();
  private hookSubscriptions = new Map<string, Set<PluginWorker>>();
  private contextIdCounter = 0;
  private contextMap = new Map<string, any>(); // contextId -> real context
  private workerContexts = new Map<PluginWorker, Set<string>>(); // worker -> set of contextIds it uses
  private registeredEvents = new Set<string>();
  private static instance: PluginManager | null = null;

  constructor(mainApi?: ExtensionAPI) {
    this.mainApi = mainApi;
  }

  /**
   * Get or create the singleton PluginManager for the current session.
   */
  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * Set the main API, called by factory after creation.
   */
  setMainApi(api: ExtensionAPI) {
    this.mainApi = api;
  }

  /**
   * Load an extension module in its own worker.
   */
  async loadExtension(modulePath: string, name?: string, entryName?: string): Promise<string> {
    const extensionName = name ?? this.getNameFromPath(modulePath);
    if (this.workers.has(extensionName)) {
      throw new Error(`Extension ${extensionName} is already loaded`);
    }
    const entry = new URL('./plugin-worker-entry.js', import.meta.url).pathname;
    const worker = new PluginWorker(entry, { modulePath, entryName });
    this.workers.set(extensionName, worker);
    this.workerContexts.set(worker, new Set());
    if (this.mainApi) {
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
      // Remove from hook subscriptions
      for (const [event, workers] of this.hookSubscriptions) {
        workers.delete(worker);
        if (workers.size === 0) {
          // Could deregister main event handler to save overhead; optional
        }
      }
      // Clean up renderer associations
      for (const [customType, w] of this.rendererWorkers) {
        if (w === worker) {
          this.rendererWorkers.delete(customType);
        }
      }
      // Clean up command mappings
      for (const [cmdName, w] of this.commandWorkers) {
        if (w === worker) {
          this.commandWorkers.delete(cmdName);
        }
      }
      // Clean up tool call updates
      for (const [toolCallId, updateFn] of this.toolCallOnUpdates) {
        // If associated with this worker? Not easily tracked; but worker termination should cleanup; we can leave it as is.
      }
      // Clean up context references
      const ctxIds = this.workerContexts.get(worker);
      if (ctxIds) {
        for (const ctxId of ctxIds) {
          this.contextMap.delete(ctxId);
        }
        this.workerContexts.delete(worker);
      }
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

  /**
   * Get metrics snapshot for all plugin workers.
   */
  getWorkersMetrics(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    for (const [name, worker] of this.workers) {
      snapshot[name] = worker.getMetrics();
    }
    return snapshot;
  }

  private getNameFromPath(path: string): string {
    const base = path.split('/').pop() ?? path;
    return base.replace(/\.[^.]*$/, '');
  }

  // ------------------------------------------------------------------------
  // Context bridging
  // ------------------------------------------------------------------------


  // We need to know the worker when creating the stub. So we'll not call sanitizeContext directly; instead we'll have a method:
  private createContextProxy(worker: PluginWorker, ctx: any): any {
    const ctxId = `ctx-${this.contextIdCounter++}`;
    this.contextMap.set(ctxId, ctx);
    const workerCtxs = this.workerContexts.get(worker);
    if (workerCtxs) {
      workerCtxs.add(ctxId);
    } else {
      // If worker not tracked (shouldn't happen), still add
    }
    // Snapshot synchronous properties from context at creation
    const uiTheme = ctx.ui?.theme;
    const ctxModel = ctx.model;

    const proxy: any = {
      ctxId,
      cwd: ctx.cwd,
      signal: ctx.signal,
      model: ctxModel, // snapshot of current model
      // Flags
      getFlag: (name: string) => this.invokeWorkerMethod(worker, 'get_flag', { name }),
      registerFlag: (name: string, options: any) => this.invokeWorkerMethod(worker, 'register_flag', { name, options }),
      // UI methods plus snapshot properties
      ui: {
        theme: uiTheme,
        notify: (message: string, type?: string) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'ui_notify', args: [message, type] }),
        setWidget: (key: string, content: any, options?: any) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'ui_setWidget', args: [key, content, options] }),
        setHeader: (factory: any) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'ui_setHeader', args: [factory] }),
        setFooter: (factory: any) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'ui_setFooter', args: [factory] }),
        setTitle: (title: string) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'ui_setTitle', args: [title] }),
        setToolsExpanded: (expanded: boolean) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'ui_setToolsExpanded', args: [expanded] }),
        getToolsExpanded: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'ui_getToolsExpanded', args: [] }),
        custom: (name: string, props?: any) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'ui_custom', args: [name, props] }),
      },
      // Actions
      abort: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'abort', args: [] }),
      hasPendingMessages: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'hasPendingMessages', args: [] }),
      shutdown: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'shutdown', args: [] }),
      getContextUsage: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'getContextUsage', args: [] }),
      compact: (options?: any) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'compact', args: [options] }),
      getSystemPrompt: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'getSystemPrompt', args: [] }),
      // Session navigation
      navigateTree: (targetId: string, options?: any) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'navigateTree', args: [targetId, options] }),
      // Messaging
      sendMessage: (message: any, options?: any) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'sendMessage', args: [message, options] }),
      // Fork/clone
      fork: (entryId: string, forkOptions?: any) => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'fork', args: [entryId, forkOptions] }),
      // Session reload
      reload: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'reload', args: [] }),
      // Idle status
      isIdle: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'isIdle', args: [] }),
      // Plugin metrics
      getPluginMetrics: () => this.invokeWorkerMethod(worker, 'get_plugin_metrics', {}),
    };

    // Expose model, theme, etc. as getters that query main on demand
    Object.defineProperties(proxy, {
      model: {
        get: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'getModel', args: [] }),
        enumerable: true,
      },
      theme: {
        get: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'getTheme', args: [] }),
        enumerable: true,
      },
      allThemes: {
        get: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'getAllThemes', args: [] }),
        enumerable: true,
      },
      mode: {
        get: () => this.invokeWorkerMethod(worker, 'ctx_call', { ctxId, method: 'getMode', args: [] }),
        enumerable: true,
      },
    });

    return proxy;
  }

  private async invokeWorkerMethod(worker: PluginWorker, method: string, params: any): Promise<any> {
    return await worker.invoke(method, params);
  }

  private async handleContextCall(ctxId: string, method: string, args: any[]): Promise<any> {
    const ctx = this.contextMap.get(ctxId);
    if (!ctx) throw new Error(`Unknown context ID: ${ctxId}`);

    // Special UI methods prefixed with 'ui_'
    if (method.startsWith('ui_')) {
      const uiMethod = method.slice(3); // e.g., 'ui_setWidget' -> 'setWidget'
      if (typeof (ctx.ui as any)[uiMethod] === 'function') {
        return await (ctx.ui as any)[uiMethod](...args);
      }
      throw new Error(`UI method ${uiMethod} not found on context`);
    }

    // Team manager methods
    switch (method) {
      case 'getAllTeams': {
        const teamManager = (ctx as any).teamManager ?? getDefaultTeamManager();
        const teams = teamManager.getAll();
        return Array.from(teams.keys());
      }
      case 'getTeamStatus': {
        const teamId = args[0];
        const teamManager = (ctx as any).teamManager ?? getDefaultTeamManager();
        return await teamManager.getTeamStatus(teamId);
      }
      case 'getModel': return (ctx as any).model;
      case 'getTheme': return (ctx.ui as any)?.theme;
      case 'getAllThemes':
        if (typeof ctx.getAllThemes === 'function') return await ctx.getAllThemes();
        return [];
      case 'getMode': return (ctx as any).mode;
      case 'getSystemPrompt': return ctx.getSystemPrompt ? await ctx.getSystemPrompt() : undefined;
    }

    // Regular method on context
    const fn = (ctx as any)[method];
    if (typeof fn !== 'function') throw new Error(`Context method ${method} not found`);
    return await fn.apply(ctx, args);
  }

  // ------------------------------------------------------------------------
  // Event forwarding
  // ------------------------------------------------------------------------
  private ensureEventForwarding(eventName: string) {
    if (this.registeredEvents.has(eventName)) return;
    // Register a handler on mainApi for this event that forwards to all subscribed workers
    if (!this.mainApi) return;
    this.mainApi.on(eventName as any, async (eventPayload: any, ctx: any) => {
      const workers = this.hookSubscriptions.get(eventName);
      if (!workers || workers.size === 0) return;
      const sanitizedCtx = this.createContextProxy(null as any, ctx); // We don't have worker reference, but we need to create a context proxy associated with the calling event's context. However the worker that will call back needs to have the context stub associated with it? Actually the contextId needs to be unique and the context stored; the stub methods will call back via the worker that invoked the hook. But we need to know which worker to use for the RPC. In the forwarder we are about to send an 'invoke_hook' request to each worker. That worker will receive the hookParams and the context stub. The stub's methods need to call back to main, not to a specific worker. That's fine: the stub doesn't need to know the worker; it just does RPC to main (which will route based on contextId). So we can create the context stub using a dummy worker (null) but we still need to associate the contextId with the real context. Our createContextProxy expects a worker to track its contexts. For cleanup on worker unload we need to know which worker holds the context. If we create a context stub without associating it to any worker, cleanup won't happen. However, the context is only used during the hook invocation. After the hook returns, the worker might discard the stub. We don't count references; we just keep the context in contextMap until worker unload. So we need to associate the context with the worker being invoked. But we don't know which worker until we iterate workers. We could create a separate context stub for each worker, each with its own contextId. That's wasteful but safe. Or we could not use context proxy at all for hooks: we could forward the real context object? That might contain non-serializable fields. So we need proxy. And we need to associate the contextId with the worker. We can modify createContextProxy to accept a worker and also store the ctxId in that worker's set. That's good. But here we are creating a context to send to potentially multiple workers. The simplest: for each worker, we create a distinct contextId and proxy. That's fine: we allocate per-worker-per-event-invocation contexts. They will be cleaned up when the worker unloads (since we track ctxIds per worker). That's acceptable.
      const workerList = Array.from(workers);
      // Build an array of promises for each worker's invoke_hook, each with its own context proxy.
      const tasks = workerList.map(async (worker) => {
        const ctxProxy = this.createContextProxy(worker, ctx);
        await worker.invoke('invoke_hook', {
          hookEvent: eventName,
          hookParams: eventPayload,
          ctx: ctxProxy,
        });
      });
      await Promise.allSettled(tasks);
    });
    this.registeredEvents.add(eventName);
  }

  /**
   * Register a main-side listener for an event if not already done.
   * Called when a worker first subscribes to an event.
   */
  private setupEventForwarding(eventName: string) {
    this.ensureEventForwarding(eventName);
  }

  // ------------------------------------------------------------------------
  // Worker message handling
  // ------------------------------------------------------------------------
  private async handleWorkerMessage(extensionName: string, msg: any): Promise<void> {
    const worker = this.workers.get(extensionName);
    if (!worker) return;

    // Handle one-way messages from worker (registration, send_message, etc.)
    if (msg.type === 'register_tool') {
      const tool = (msg as any).tool as any;
      tool.execute = async (toolCallId: string, callParams: any, signal?: AbortSignal, onUpdate?: (update: any) => void, ctx?: any) => {
        if (onUpdate) this.toolCallOnUpdates.set(toolCallId, onUpdate);
        try {
          const result = await worker.invoke('execute_tool', {
            toolName: tool.name,
            toolCallId,
            params: callParams,
            ctx: this.createContextProxy(worker, ctx),
          });
          return result;
        } finally {
          if (onUpdate) this.toolCallOnUpdates.delete(toolCallId);
        }
      };
      if (this.mainApi) this.mainApi.registerTool(tool);
      return;
    }
    if (msg.type === 'register_command') {
      const { name, command } = msg as any;
      command.execute = async (cmdParams: any, ctx?: any) => {
        return await worker.invoke('execute_command', { commandName: name, params: cmdParams, ctx: this.createContextProxy(worker, ctx) });
      };
      this.commandWorkers.set(name, worker);
      if (this.mainApi) this.mainApi.registerCommand(name, command);
      return;
    }
    if (msg.type === 'register_renderer') {
      const { customType, renderer } = msg as any;
      this.rendererWorkers.set(customType, worker);
      return;
    }
    if (msg.type === 'register_hook') {
      const { event } = msg as any;
      let workers = this.hookSubscriptions.get(event);
      if (!workers) { workers = new Set(); this.hookSubscriptions.set(event, workers); }
      workers.add(worker);
      this.setupEventForwarding(event);
      return;
    }
    if (msg.type === 'send_message') {
      const { message, options } = msg as any;
      if (this.mainApi) this.mainApi.sendMessage(message, options);
      return;
    }


    if (msg.type === 'request') {
      const { id, method, params } = msg;
      let response: any = { type: 'response', id };
      try {
        switch (method) {
          case 'register_tool': {
            const tool = params.tool as any;
            const originalExecute = tool.execute.bind(tool);
            tool.execute = async (toolCallId: string, callParams: any, signal?: AbortSignal, onUpdate?: (update: any) => void, ctx?: any) => {
              if (onUpdate) {
                this.toolCallOnUpdates.set(toolCallId, onUpdate);
              }
              try {
                const result = await worker.invoke('execute_tool', {
                  toolName: tool.name,
                  toolCallId,
                  toolParams: callParams,
                  ctx: this.createContextProxy(worker, ctx),
                });
                return result;
              } finally {
                if (onUpdate) {
                  this.toolCallOnUpdates.delete(toolCallId);
                }
              }
            };
            if (this.mainApi) this.mainApi.registerTool(tool);
            response.result = undefined;
            break;
          }
          case 'register_command': {
            const { name, command } = params as any;
            const originalExecute = command.execute.bind(command);
            command.execute = async (cmdParams: any, ctx?: any) => {
              return await worker.invoke('execute_command', {
                commandName: name,
                cmdParams,
                ctx: this.createContextProxy(worker, ctx),
              });
            };
            this.commandWorkers.set(name, worker);
            if (this.mainApi) this.mainApi.registerCommand(name, command);
            response.result = undefined;
            break;
          }
          case 'register_renderer': {
            const { customType } = params as any;
            this.rendererWorkers.set(customType, worker);
            // Register a proxy renderer with main that forwards to worker and builds component from descriptor
            if (this.mainApi && typeof this.mainApi.registerMessageRenderer === 'function') {
              const proxyRenderer = async (message: any, options: any, theme: any) => {
                const desc = await worker.invoke('render_message', { customType, message, options, theme });
                return descriptorToComponent(desc);
              };
              this.mainApi.registerMessageRenderer(customType, proxyRenderer as any);
            }
            response.result = undefined;
            break;
          }
          case 'register_hook': {
            const { event } = params as any;
            // Add worker to subscription set
            let workers = this.hookSubscriptions.get(event);
            if (!workers) {
              workers = new Set();
              this.hookSubscriptions.set(event, workers);
            }
            workers.add(worker);
            // Ensure main forwards this event
            this.setupEventForwarding(event);
            response.result = undefined;
            break;
          }
          case 'unregister_hook': {
            const { event } = params as any;
            const workers = this.hookSubscriptions.get(event);
            if (workers) {
              workers.delete(worker);
              if (workers.size === 0) {
                // Optionally stop forwarding this event; but we keep the mainApi listener for simplicity
                // Could call this.mainApi.off(event as any, ...) if we tracked the handler
              }
            }
            response.result = undefined;
            break;
          }
          case 'send_message': {
            const { message, options } = params as any;
            if (this.mainApi) this.mainApi.sendMessage(message, options);
            response.result = undefined;
            break;
          }
          case 'get_flag': {
            const { name } = params as any;
            response.result = this.mainApi?.getFlag?.(name);
            break;
          }
          case 'register_flag': {
            const { name, options } = params as any;
            if (this.mainApi?.registerFlag) this.mainApi.registerFlag(name, options);
            response.result = undefined;
            break;
          }
          case 'get_plugin_metrics': {
            response.result = this.getWorkersMetrics();
            break;
          }
          case 'ctx_call': {
            const { ctxId, method: ctxMethod, args: ctxArgs } = params as any;
            const result = await this.handleContextCall(ctxId, ctxMethod, ctxArgs);
            response.result = result;
            break;
          }
          default:
            throw new Error(`Unknown method: ${method}`);
        }
      } catch (err: any) {
        response.error = err.message;
      }
      worker.underlying.postMessage(response);
    } else if (msg.type === 'event') {
      // One-way events from worker to main
      if (msg.event === 'tool_update') {
        const { toolCallId, update } = msg;
        const onUpdate = this.toolCallOnUpdates.get(toolCallId);
        if (onUpdate) onUpdate(update);
      }
      // Could handle other events like 'error' if needed.
    }
  }
}
