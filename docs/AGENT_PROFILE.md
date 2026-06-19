# Agent Profile — PiClaw System

Self-assessment of the PiClaw coding agent's strengths, weaknesses, and improvement areas.

## Strengths

- **Comprehensive test suite**: 113 test files, 1072 passing, 3 skipped; coverage >80%.
- **Modular architecture**: Clear separation between core, extensions, and tools.
- **Robust team collaboration**: Multi-agent teams with task assignment, workspace isolation, zombie recovery, and metrics export.
- **TypeScript strict mode**: Strong typing, early error detection.
- **Persistent state management**: Todos, configuration, and metrics are safely stored.
- **Extensible tool system**: Standardized API with input validation and security best practices (command escaping, path confinement).
- **Property-based testing**: Core invariants validated with `fast-check`.
- **TUI performance**: Memoized rendering and event-driven updates reduce CPU usage; metrics dashboard provides observability.
- **Documentation**: CONTRIBUTING guide, ADRs, and extensive inline comments.

## Weaknesses

- **Console coupling in tests**: Some tests still spy directly on `console` rather than logger, making them brittle to future logger enhancements. Migration to logger-aware test utilities is a medium-priority refactor.
- **Metrics rotation**: `.piclaw/metrics.json` appends JSON lines indefinitely; long-running sessions could accumulate large files. Need rotation/cleanup.
- **Config validation**: Minimal schema validation for `~/.piclaw/config.json`; could benefit from stricter defaults and type coercion.
- **Windows compatibility**: Some path operations assume POSIX; full Windows testing is pending.

## Fragile Modules

- `extensions/tools/todos-tool.ts`:
  - Legacy error paths tested with console spies; sensitive to logger wrapper changes.
  - `loadTodoFromFile` catch block is critical; any change may break edge case tests.
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

1. **Test logger integration**: Provide a test-friendly logger mock and migrate console-spy tests gradually.
2. **Metrics rotation**: Implement size-based rotation or compression for `.piclaw/metrics.json`.
3. **Config schema**: Add robust validation with defaults using a lightweight schema library.
4. **Windows compatibility**: Add CI matrix for Windows or adjust path utilities.
5. **Consider DB client tool** (moderate priority) or confirm current toolset sufficient.

*Note: Coverage target ≥80% achieved; continue to maintain as features evolve.*

---

*This profile will be updated after each evolution iteration to track progress and new weaknesses.*
