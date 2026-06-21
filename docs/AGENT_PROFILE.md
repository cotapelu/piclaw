# Agent Profile — PiClaw System

Self-assessment of the PiClaw coding agent's strengths, weaknesses, and improvement areas.

## Strengths

- **Comprehensive test suite**: 117 test files, 1118 passing, 0 skipped; coverage >80%.
- **Modular architecture**: Clear separation between core, extensions, and tools.
- **Robust team collaboration**: Multi-agent teams with task assignment, workspace isolation, zombie recovery, and metrics export.
- **TypeScript strict mode**: Strong typing, early error detection.
- **Persistent state management**: Todos, configuration, and metrics are safely stored.
- **Extensible tool system**: Standardized API with input validation and security best practices (command escaping, path confinement).
- **Property-based testing**: Core invariants validated with `fast-check`.
- **TUI performance**: Memoized rendering and event-driven updates reduce CPU usage; metrics dashboard provides observability.
- **Documentation**: CONTRIBUTING guide, ADRs, and extensive inline comments.
- **Team isolation**: `InstanceTeamManager` provides per-session team state, eliminating cross-session interference.
- **Plugin isolation**: Core infrastructure (`PluginWorker`, `PluginManager`, and worker entry) enables extensions to run in separate worker threads, with request/response messaging and timeout support.
- **Plugin isolation default**: `plugins.isolate` is now `true` by default; built-in tools, commands, and hooks run isolated automatically.
- **Plugin observability**: Plugin worker metrics are exposed via the TUI metrics widget and Prometheus exporter, enabling real-time monitoring of plugin health and performance.

## Weaknesses

- **Console coupling in tests**: Mostly resolved; only logger unit tests (`logger.test.ts`, `logger-core.test.ts`) legitimately spy on console. All other tests now use injected or mock loggers.
- **Metrics rotation**: Implemented daily rotation to prevent unbounded growth; long-term cleanup strategy could be improved (e.g., age-based retention).
- **Config validation**: Basic validation for `verbose`, `tools`, `thinking`, `model` (format `provider:model`), and `keybindings` (object type) is in place; further value checks possible.
- **Windows compatibility**: Some path operations assume POSIX; full Windows testing is pending.

## Fragile Modules

- `extensions/tools/todos-tool.ts`:
  - `loadTodoFromFile` error handling now uses injectable logger; console coupling removed. Tests stable.
  - Critical file I/O path still needs thorough edge case coverage, but logger abstraction no longer a fragility.
- `extensions/team/team-manager.ts`:
  - `dispose()` sequence relies on correct ordering; errors during disposal could leave dangling promises.
  - `auto-dispose` timer interactions with team activity can be subtle.
- `src/piclaw-package-manager.ts`:
  - Update dry-run and logging paths must remain consistent with user expectations.
- `extensions/metrics/metrics-widget.ts`:
  - The memoization cache logic must correctly detect content changes; incorrect comparison could cause missed updates.

## Common Failure Modes

- **Prefix mismatch**: When logger includes a prefix, tests expecting exact `console` arguments fail. Mitigated by default logger using no prefix in tests.
- **Async race conditions**: Mostly handled by mutexes; high concurrency scenarios largely covered by threshold tests.
- **Path handling**: POSIX assumptions; Windows paths with backslashes may need adjustment.
- **Version coupling**: Tight dependency on `@earendil-works/*` package versions; breaking changes upstream require review.

## Improvement Focus (Next)

- **Windows compatibility testing**: Ensure path handling and process spawning work on Windows; add CI matrix if feasible.
- **Metrics retention policy**: Implement age-based cleanup for daily metric files to avoid disk bloat over time.
- **Plugin isolation** (P6): Extend isolation to remaining extension types (renderers, hooks, widgets) and consider making isolation default for all built‑ins.

*Note: Coverage target ≥80% achieved; continue to maintain as features evolve.*

---

*This profile will be updated after each evolution iteration to track progress and new weaknesses.*
