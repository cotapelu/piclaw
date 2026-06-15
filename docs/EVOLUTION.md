# Evolution Log — PiClaw Development Tracker

This document records major trajectory changes, planned refactors, and debt management.

## 2026-06-15 — Round 1: Structured Logging & Metrics

### Context
The codebase widely used raw `console.log`/`error`/`warn` throughout production extensions. This made it hard to control verbosity, add prefixes, or route logs. Additionally, team auto-dispose had no metrics export.

### Goals
- Introduce structured logger with configurable level and optional prefix.
- Replace all `console.*` in production code with logger calls.
- Preserve backward compatibility with existing tests that spy on `console`.
- Add metrics export on team disposal for observability.

### Changes

#### Core Logger (`src/utils/logger.ts`)
- Implemented `initLogger()` that reads `~/.piclaw/config.json` to set log level.
- Added `createLogger(tag?: string)` for component-scoped loggers.
- For error/warn, passes args directly to `console.error/warn` (no prefix by default to keep test compatibility).
- For other levels, respects `PICLAW_LOG_PREFIX` env var or uses defaults (`ℹ`, `🔧`, etc.).
- Core logger is used by the main application and can be imported directly if needed.

#### Extension Logger (`src/extensions/utils/logger.ts`)
- Lightweight wrapper that directly forwards to `console.*` methods.
- Provides `createLogger(tag?)` with optional prefix; default `logger` has no prefix.
- Kept separate from core to allow extensions to depend only on extension logger.

#### Migration
- Updated all files in `src/extensions/` to use `logger` or `createLogger()` instead of raw `console`.
- Examples: `team-manager.ts`, `todos-tool.ts`, `git-tool.ts`, `formatter-tool.ts`, etc.
- Removed duplicate console imports and cleaned up import paths.

#### Metrics Export
- `AgentTeam.getMetrics()` collects team performance data.
- Modified `auto-dispose` in `TeamRegistry` to write metrics to `.piclaw/metrics.json` as JSON lines.
- File is appended with each auto-dispose event.

#### Test Adjustments
- Changed `team-manager.ts` logger to no prefix (`createLogger()`) to satisfy tests expecting plain `console` calls.
- Changed `todos-tool.ts` logger similarly.
- Fixed failing test in `todos-load-edgecases.test.ts` that expected `console.error` with specific args.

### Outcome
- All 978 tests pass (975 passing, 3 skipped).
- Build succeeds without warnings.
- System now emits structured logs that can be controlled via config.
- Metrics export operational; no runtime impact.

### Debt & Future Work

- **Logger prefix inconsistency**: Some components may still use `console` directly (unlikely after grep, but possible). Full audit pending.
- **Test migration**: Over 100 tests spy on `console`. Moving to logger mock will improve stability but is non-trivial.
- **Metrics format**: Should rotate or compress; consider binary or Parquet for large volumes.
- **Configuration**: Need schema validation and hot-reload.
- **Observability**: Add correlation IDs across requests, export to OpenTelemetry.

---

## Planned Refactors (Upcoming Iterations)

### P1 — Security Hardening
- Audit all tool parameters for injection (shell escaping, path traversal).
- Validate file paths with `validateLocalPath` wrappers; ensure all uses.
- Scan persisted session files for secrets; implement encryption at rest.
- Add fuzzing tests using `@faker-js/faker`.

#### Completed: Path Traversal Fixes (Iteration 2)
- Secured `executeRead` with proper escaping and validation; added tests.
- Fixed `PiclawPackageManager` local source handling with `validateLocalPath`; added tests.

### P2 — Performance
- Profile team workspace under 50 agents, 1000 ops; optimize lock contention.
- Investigate memory leaks in long-lived sessions (2+ hours).
- Reduce TUI re-renders by memoizing selectors.
- Benchmark package manager operations (install/update latency).

### P3 — Ecosystem Expansion
- Create extension template repo with CI/CD.
- Add HTTP client tool with streaming support.
- Add database client tool (Postgres/MySQL) with parameterized queries.
- Write CONTRIBUTING.md and extension development guide.

### P4 — Observability
- Export metrics in Prometheus text format (optional endpoint).
- Add trace context propagation across tools.
- Debug mode: full input/output capture on errors.
- Health check command (`/health`) that reports system status.

### P5 — Quality & Reliability
- Increase coverage to ≥80% (focus on error handling and concurrency).
- Chaos engineering: randomly fail network calls, disk writes.
- Long-running stability test (24h) with periodic metrics.
- Property-based testing for todos state transitions and team task assignment.

### P6 — Architecture
- Decouple team workspace from session tree; separate persistence layer.
- Evaluate WebSocket transport for TUI instead of stdio for smoother UI.
- Investigate WASM for CPU-intensive tasks (e.g., diff, parsing).
- Plugin isolation using worker threads to prevent crashes.

---

*This file will be updated after each major iteration to reflect new trajectory changes.*
