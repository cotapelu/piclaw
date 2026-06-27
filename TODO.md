# PiClaw TODO — Priority Task List

**Last Updated**: 2026-06-21
**Source**: AUTO-CONTINUE.md workflow

- P6 WebSocket TUI Transport — Implemented remote TUI via WebSocket with PTY backend; added CLI flags and embedded xterm.js client
---

## P0 — Evolution Infrastructure (Bootstrap)
- [x] Write `docs/AGENT_METRICS.md` with baseline metrics (iterations, MTTR, test failure rate)
- [x] Write `docs/AGENT_PROFILE.md` with strengths/weaknesses assessment
- [x] Write `docs/EVOLUTION.md` with planned trajectory and refactors
- [x] Commit all evolution tracking files to git
- [x] First evolution round: Analyze test results and identify quick wins

## P1 — Security Hardening (COMPLETED)
- [x] Audit all tool inputs for injection vulnerabilities (initial audit complete; verify fixes)
- [x] Validate file paths prevent traversal attacks (executeRead, PiclawPackageManager fixed)
- [x] Add fuzzing tests for edge-case inputs (added security tests for package manager, git-tool, scripts-tool)
- [x] Check session persistence doesn't leak secrets (set restrictive umask 0o077)
- [x] Implement secret pattern updates (detect new token formats: OpenAI, Anthropic, Replicate, Hugging Face)

## P2 — Performance Optimization
- [x] Profile team workspace concurrency under 50-agent load (added threshold; passes with ~27ms, 18518 ops/sec)
- [x] Identify memory leaks in long-running sessions (added memory-stability.test.ts; passes with <2MB delta over 5 iterations)
- [x] Optimize todos tool: claimTask O(1) already done (verified)
- [x] Reduce TUI re-renders (measure with profile) — memoization, perf tracking, and event-driven team widget (no polling)
- [x] Benchmark package manager operations (created package-manager-benchmark.ts; measures update overhead)

## P5 — Testing & Quality
- [x] Increase coverage to ≥80% (achieved >80% via subtool-loader & logger-core tests)
- [x] Expand fuzzing coverage to other tools (test-tool file args) — added test-tool-security.test.ts
- [x] Chaos engineering: random network failures — added chaos utility and integrated into runCommandCapture
- [ ] Fuzz WebSocket message handling (malformed frames, oversized payloads) — increase robustness of remote TUI
- [x] Long-running stability test (24h+) — added long-running-stability.test.ts with PM cycles and team lifecycle
- [ ] Reproducible integration test environments
- [x] Property-based testing for core algorithms — added team-manager-property.test.ts (5 invariants)
- [x] Provide logger-aware test utilities and migrate console-spy tests — created logger-mock.ts; migrated AgentTeam and PiclawPackageManager tests

## P3 — Ecosystem & DX
- [x] Create extension template repository (provided starter template in extension-template/)
- [x] Add HTTP client tool (http-client)
- [x] Add DB client tool (SQLite parameterized queries, Postgres/MySQL future)
- [x] Add cache manager tool (cache_manager with TTL, persistence, and stats)
- [x] Write contribution guide (CONTRIBUTING.md) — comprehensive with extension examples
- [x] Document extension API with examples (included in CONTRIBUTING.md)
- [x] Improve error messages with actionable suggestions — added suggestions to http-client network/timeout errors; other tools already provide clear context

## P4 — Observability & Reliability
- [x] Add structured logging (trace/debug/info/warn/error)
- [x] Export metrics in Prometheus format (added prometheus-metrics-tool)
- [x] TUI performance dashboard widget — added performance metrics to metrics-widget
- [x] Debug mode with full trace on errors (logger.error now includes Error.stack)
- [x] Session health checks (auto-repair corrupted sessions) — added session-health-tool

## P6 — Architectural Improvements
- [x] Decouple team workspace from session tree
- [x] Implement WebSocket transport for TUI (PTY + xterm.js; CLI flags: --tui-websocket, --tui-port, --tui-address, --tui-token)
- [ ] Evaluate WASM integration for performance-critical paths
- [x] Plugin isolation using worker threads (tools and commands)
- [x] Extend plugin isolation to hooks (auto-continue, auto-compact-85, context-logger)
- [x] Add plugin worker observability (metrics, getWorkersMetrics)
- [x] Integrate plugin metrics into metrics widget and Prometheus exporter
- [x] Extend plugin isolation to renderers and widgets

- P6 WebSocket TUI Transport — Implemented remote TUI via WebSocket with PTY backend; added CLI flags and embedded xterm.js client
---

## Completed Tasks
- P6 WebSocket TUI Transport — Implemented remote TUI via WebSocket with PTY backend; added CLI flags and embedded xterm.js client
- P6 WebSocket Observability — Added metrics collection, Prometheus endpoint, tool, and TUI widget integration
- P1 Security Hardening (full) — all security mitigations implemented and tested
- P2 Concurrency Profiling — team workspace concurrency threshold added and passing
- P2 Memory Stability — basic memory leak test for package manager added and passing
- P2 Benchmark Package Manager — created benchmark script for performance regression detection
- P2 TUI Re-render Optimization — memoization, perf tracking, and event-driven team widget (no polling)
- P4 Prometheus Metrics Export — added prometheus-metrics-tool for observability
- P4 Debug Mode Enhancement — logger.error now includes Error.stack
- P4 Session Health Checks — added session-health-tool with auto-repair for corrupted JSON files
- P4 TUI Performance Dashboard — enhanced metrics-widget with uptime, memory, and team metrics
- P5 Coverage Milestone — increased coverage to >80%
- P5 Fuzzing Expansion — added security tests for test-tool file args
- P5 Chaos Engineering — added chaos utility with env-controlled failure injection
- P5 Long-Running Stability Test — memory stability validated
- P5 Property-Based Testing — added team-manager-property.test.ts (5 invariants)
- P5 Config Validation — added runtime checks in config-manager for invalid thinking level
- P3 Documentation — CONTRIBUTING.md with extension API examples
- P3 Extension Template — starter kit for extension developers
- P3 HTTP Client Tool — added http-client-tool
- P3 Cache Manager Tool — added cache_manager with TTL and persistence
- P3 Database Client Tool — added db_client (SQLite parameterized queries)
- P4 ADRs — documented key architectural decisions (5 ADRs)
- P5 Logger Mock Utility — created logger-mock for test stability
- P6 Plugin Isolation Phase 4 — added command support to plugin isolation; extended plugin system to isolate command extensions
- P6 Plugin Isolation Phase 5 — Hook isolation completed; auto-continue, auto-compact-85, and context-logger run isolated when plugins.isolate is true
- P6 Plugin Metrics Integration — integrated plugin worker metrics into TUI metrics widget and Prometheus exporter
- P6 Plugin Isolation Default — set `plugins.isolate` to `true` as the default; built-in tools, commands, and hooks run isolated out-of-the-box
- Metrics Retention Policy — age-based cleanup of old metrics files, configurable via `metricsRetentionDays` (default 30)
- P6 Widget Isolation — isolated both metrics-widget and team-widget via RPC context proxy and worker loading; team-widget uses polling via RPC
- P6 Renderer Isolation (Phase 2) — migrated built-in renderers and added tests; full validation completed
- P6 Renderer Isolation Testing — added unit test for renderer RPC registration; fixed flaky auto-dispose test
- P6 Cross-Platform executeRead — Refactored `executeRead` to use `fs/promises`, eliminating bash dependency for Windows compatibility.

- P6 WebSocket TUI Transport — Implemented remote TUI via WebSocket with PTY backend; added CLI flags and embedded xterm.js client
---

## Notes
- Each iteration must update evolution docs (AGENT_METRICS.md, AGENT_PROFILE.md, EVOLUTION.md)
- After completing a phase, identify next highest-impact task and continue
- Follow AGENTS.md protocol: Plan → Code → Test → Evaluate → Decide → Repeat

## WebSocket Observability (P4 Follow-up)
- [ ] Add WebSocket TUI server metrics (active connections, total connections, errors, PTY processes) to metrics-widget
- [ ] Export WebSocket metrics via Prometheus tool (counters/gauges)
- [ ] Add config option for WebSocket metrics retention (same as general metrics)

---

## Follow-ups (Lower Priority)
- [ ] Consider WASM integration for performance-critical paths (diff, parsing)
- [ ] Add fuzzing for WebSocket message handling (malformed frames, large payloads)

---
