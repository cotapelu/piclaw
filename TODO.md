# PiClaw TODO — Priority Task List

**Last Updated**: 2026-06-15
**Source**: AUTO-CONTINUE.md workflow

---

## P0 — Evolution Infrastructure (Bootstrap)
- [x] Write `docs/AGENT_METRICS.md` with baseline metrics (iterations, MTTR, test failure rate)
- [x] Write `docs/AGENT_PROFILE.md` with strengths/weaknesses assessment
- [x] Write `docs/EVOLUTION.md` with planned trajectory and refactors
- [x] Commit all evolution tracking files to git
- [x] First evolution round: Analyze test results and identify quick wins

## P1 — Security Hardening
- [x] Audit all tool inputs for injection vulnerabilities (initial audit complete; verify fixes)
- [x] Validate file paths prevent traversal attacks (executeRead, PiclawPackageManager fixed)
- [ ] Check session persistence doesn't leak secrets
- [ ] Add fuzzing tests for edge-case inputs (partial: added path traversal tests)
- [ ] Implement secret pattern updates (detect new token formats)

## P2 — Performance Optimization
- [ ] Profile team workspace concurrency under 50-agent load
- [ ] Identify memory leaks in long-running sessions (uses 30+ min)
- [ ] Optimize todos tool: claimTask O(1) already done, verify at scale
- [ ] Reduce TUI re-renders (measure with profile)
- [ ] Benchmark package manager operations

## P3 — Ecosystem & DX
- [ ] Create extension template repository
- [ ] Add more built-in tools: http-client, db-client, cache-manager
- [ ] Write contribution guide (CONTRIBUTING.md)
- [ ] Document extension API with examples
- [ ] Improve error messages with actionable suggestions

## P4 — Observability & Reliability
- [x] Add structured logging (trace/debug/info/warn/error)
- [ ] Export metrics in Prometheus format
- [ ] TUI performance dashboard widget
- [ ] Debug mode with full trace on errors
- [ ] Session health checks (auto-repair corrupted sessions)

## P5 — Testing & Quality
- [ ] Increase coverage to ≥80% (current ~70%)
- [ ] Chaos engineering: random network failures
- [ ] Long-running stability test (24h+)
- [ ] Reproducible integration test environments
- [ ] Property-based testing for core algorithms

## P6 — Architectural Improvements
- [ ] Decouple team workspace from session tree
- [ ] Consider WebSocket transport for TUI instead of stdio
- [ ] Evaluate WASM integration for performance-critical paths
- [ ] Plugin isolation using worker threads

---

## Completed Tasks
*(none yet)*

---

## Notes
- Each iteration must update evolution docs (AGENT_METRICS.md, AGENT_PROFILE.md, EVOLUTION.md)
- After completing a phase, identify next highest-impact task and continue
- Follow AGENTS.md protocol: Plan → Code → Test → Evaluate → Decide → Repeat
