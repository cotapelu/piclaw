# Agent Profile — PiClaw System

Self-assessment of the PiClaw coding agent's strengths, weaknesses, and improvement areas.

## Strengths

- **Comprehensive test suite**: 978 tests covering most modules with high coverage.
- **Modular architecture**: Clear separation between core, extensions, and tools.
- **Robust team collaboration**: Multi-agent teams with task assignment, workspace isolation, and zombie recovery.
- **TypeScript strict mode**: Strong typing, early error detection.
- **Persistent state management**: Todos, configuration, and metrics are safely stored.
- **Extensible tool system**: Easy to add new tools with standardized API.

## Weaknesses

- **Console coupling**: Many tests directly spy on `console.error`/`console.warn`, which conflicts with structured logging efforts. A migration strategy to logger-aware test utilities is needed.
- **Error message verbosity**: Some error logs could be more actionable (e.g., include file paths, operation context).
- **Metrics format**: Currently exports JSON lines without rotation; long-term could become large.
- **Config file schema validation**: Minimal; could benefit from stricter schema with defaults.
- **Documentation gaps**: No ADRs, limited extension developer guide.

## Fragile Modules

- `extensions/tools/todos-tool.ts`:
  - Error handling path tested with console spies; sensitive to logger wrapper changes.
  - `loadTodoFromFile` catch block is critical; any change may break edge case tests.

- `extensions/team/team-manager.ts`:
  - `dispose()` sequence relies on correct ordering of cleanup; errors during runtime disposal could leave dangling promises if not carefully handled.
  - `auto-dispose` timer interactions with team activity can be subtle.

- `src/piclaw-package-manager.ts`:
  - The update method's dry-run and logging paths must remain consistent with user expectations.

## Common Failure Modes

- **Prefix mismatch**: When using a logger with prefix, tests expecting exact `console` arguments fail.
- **Async race conditions**: Though most are handled by mutexes, high concurrency exposure tests are limited.
- **Path handling**: Some file operations assume POSIX paths; Windows compatibility not fully tested.
- **Version compatibility**: Tight coupling to specific versions of `@earendil-works` packages; breaking changes upstream could cause issues.

## Improvement Focus (Next)

1. **Refactor test spies**: Replace direct `console` spies with a logger mock that can intercept logger method calls.
2. **Security hardening**: Verify command injection mitigations in git-tool and scripts-tool; add fuzzing tests for all tools.
3. **Performance profiling**: Under 50-agent load; identify memory leaks.
4. **Observability**: Add structured contexts (trace IDs), export metrics in open format.
5. **Coverage**: Increase to ≥80% with focus on error paths and concurrency.

---

*This profile will be updated after each evolution iteration to track progress and new weaknesses.*
