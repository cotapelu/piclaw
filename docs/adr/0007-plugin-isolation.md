# ADR 0007: Plugin Isolation Using Worker Threads

Date: 2026-06-19
Status: Proposed

## Context

The current extension system loads and executes all extension code (tools, commands, renderers, hooks) within the main Node.js process. While this simplifies development, a misbehaving extension (e.g., infinite loop, uncaught exception, memory leak) can crash or degrade the entire agent session.

We aim to improve robustness by isolating extensions in separate worker threads. Each extension (or extension module) would run in its own worker, communicating with the main thread via message passing. This prevents faulty extensions from bringing down the whole system and allows for timeouts, resource limits, and safer hot-reloading.

## Goals

- **Fault isolation**: Crashes or hangs in an extension must not crash the main process.
- **Graceful degradation**: If an extension worker fails, the system can disable it and continue.
- **Performance**: Minimal overhead for normal operation; worker startup should be reasonably fast.
- **Compatibility**: Existing extensions should require minimal changes (ideally only registration adjustment).
- **Observability**: Track worker health, restart counts, and resource usage.

## Options Considered

1. **No isolation (status quo)**: Rejected due to single point of failure.
2. **Separate processes** (child_process.fork): Heavier weight, more overhead, complex IPC; rejected for now.
3. **Worker threads** (node:worker_threads): Lighter weight, shared memory possible but not required, good isolation, fits Node.js ecosystem. **Preferred**.
4. **Sandboxed VM** (node:vm): Not sufficiently robust against all failure modes (e.g., native code crashes).
5. **WASM sandbox**: Too immature for our use case.

## Proposed Design

### High-Level Architecture

- Main thread maintains a registry of `Plugin Workers`.
- Each extension module runs in its own worker thread. Multiple extensions can share a worker if they are bundled together for efficiency; but for maximum isolation, one worker per extension package is simplest.
- Extension API is exposed via a proxy. Calls from main to extension are asynchronous messages; results sent back.
- Extension can call back into main (e.g., to use tools) via a `MainBridge` object that proxies requests to main thread, which executes them and returns results.

### Interfaces

**MainThread side:**
- `PluginWorker` class:
  - `constructor(modulePath: string)` starts worker, loads the extension module.
  - `invoke(method: string, args: any[])`: returns Promise to main.
  - `onMessage(callback)` for async events.
  - `terminate()`: gracefully shut down worker.
  - `health(): { alive: boolean; uptime: number }`
- `PluginManager`:
  - `loadExtension(api: ExtensionAPI, extensionDef: ExtensionDefinition)`: starts worker and registers extension.
  - `unloadExtension(name: string)`: terminates worker.
  - `handleMessage(workerId, message)`: routes messages from workers to appropriate system components.

**Worker side:**
- The extension code is packaged as a module that receives a limited `ExtensionAPI` (subset) and workers-specific `WorkerBridge`.
- The bridge provides:
  - `callMain(method: string, args: any[])`: to request main thread actions (e.g., file I/O, tools that must run in main).
  - `sendAsyncEvent(event: string, payload: any)`: to notify main of events (e.g., progress updates).
- The extension registers its tools/commands/renderers via the provided `api`. These registrations are messages back to main to actually register.

### Message Protocol

Messages are JSON-serializable objects with envelope:

```ts
{
  type: 'request' | 'response' | 'event',
  id: string, // correlation id for request/response
  method?: string,
  params?: any,
  result?: any,
  error?: string,
  event?: string,
  payload?: any
}
```

### Lifecycle

- On session start, `PluginManager` loads configured extensions (either built-in or external) in separate workers.
- If a worker exits unexpectedly (crash), `PluginManager` logs the event, can attempt restart up to N times, and marks extension as disabled if unrecoverable.
- On session shutdown, all workers are terminated gracefully.

### Error Handling

- Timeouts: If a request to a plugin exceeds a threshold (e.g., 30s), main cancels and may terminate worker.
- Exceptions: Worker catches exceptions and reports back as error response; does not crash main.
- Resource limits: Optionally use `worker.threadId` to monitor memory; could kill if exceeds threshold.

### Migration Path

1. Implement `PluginWorker` class and `PluginManager`.
2. Create a compatibility shim: existing extensions can run in a worker without modification if they only use async API. Synchronous code (rare) must be refactored to async.
3. Update built-in extensions to optionally run isolated (configurable via flag `plugins.isolate`).
4. Gradually migrate extensions to worker model; default all new extensions run isolated.
5. After validation, make isolation mandatory for all third‑party extensions.

## Consequences

### Positive

- **Robustness**: Misbehaving extensions cannot crash the core session.
- **Security**: Worker threads can be further sandboxed (e.g., restrict native modules via `--no-warnings`, `--experimental-worker` options). Future hardening possible.
- **Hot-reload**: Extension workers can be restarted individually to pick up code changes without restarting the whole session.
- **Observability**: Individual extension metrics (uptime, errors) become available.

### Negative

- **Complexity**: Added architectural complexity; debugging across threads harder.
- **Performance**: IPC overhead for extension calls (serialization/deserialization, async). Should be acceptable given typical tool execution times.
- **Compatibility**: Some extensions may rely on synchronous operations or global state; they will need refactoring.
- **Development ergonomics**: Developers must understand the async message model; logs from workers need to be aggregated.

## Alternatives Considered

- **Single worker for all extensions**: Simpler but still isolates from main; a single buggy extension could bring down all extensions (still acceptable). Could be an intermediate step.
- **Process-per-extension**: Too heavy; not chosen.

## Implementation Plan (Phased)

1. **Phase 1**: Core infrastructure: `PluginWorker`, `PluginManager`, message router. Tests for basic start/stop, invoke/response. (Iteration 28)
2. **Phase 2**: Adapt one built‑in extension (e.g., `secret-scanner`) to run in a worker. Verify functionality and performance. (Iteration 29)
3. **Phase 3**: Extend to all built‑in extensions; add config flag `plugins.isolate` (default false for compatibility). Extensive testing including chaos. (Iteration 30+)
4. **Phase 4**: Make isolation default for all extensions; provide migration guide for third‑party extensions. (Future)

## Risks

- **Worker leaks**: If workers are not properly terminated on session shutdown, resources leak. Need robust cleanup.
- **Deadlocks**: Circular dependencies between main and worker (main waiting on worker, worker waiting on main) must be avoided; timeouts mitigate.
- **Debugging difficulty**: Stack traces across worker boundaries are truncated. Mitigate with structured logging including correlation IDs.

## Monitoring & Metrics

- Track worker start/stop events, crash counts, restart attempts.
- Measure IPC latency (main→worker roundtrip).
- Record per‑extension memory usage (if feasible via `worker.threadId` and `process.memoryUsage` on that thread? Not directly exposed; may need external module).
- Export via Prometheus metrics extension.

## References

- Node.js worker_threads: https://nodejs.org/api/worker_threads.html
- Current extension factory: `src/extensions/factory.ts`
- ExtensionAPI definition in upstream `@earendil-works/pi-coding-agent`.
