# Evolution Trajectory — Planned Refactors & Debt Management

**Date**: 2026-06-15
**Current Iteration**: 0 (bootstrap)
**Methodology**: AUTO-CONTINUE.md protocol

---

## 1. EVOLUTION PRINCIPLES

Per AUTO-CONTINUE.md:
- System breaks less, fixes faster, plans further ahead, fewer repeated mistakes
- Every iteration updates AGENT_METRICS.md, AGENT_PROFILE.md, EVOLUTION.md
- Use mental testing before writing code
- Preserve debug context, never delete code to pass tests
- Assess change cost & risk (Low/Medium/High)

---

## 2. TRAJECTORY GOALS (12-month horizon)

| Goal | Metric | Baseline | Target (12mo) |
|------|--------|----------|---------------|
| Reliability | Test pass rate | 100% | 100% |
| Quality | Coverage | ~70% | ≥85% |
| Security | Vulnerabilities | 0 (last scan) | 0 |
| Performance | Build time | 8s | <5s |
| DX | Setup steps | 5+ | 2 (`npm install && piclaw`) |
| Ecosystem | Built-in tools | 14 | 25+ |
| Observability | Metrics visible | No | Yes (TUI widget) |

---

## 3. ITERATION PLAN (Next 10 iterations)

### Iteration 1: Security Hardening (P1)
**Risk**: Low (mostly audit + tests)
**Cost**: 2-3 days

**Tasks**:
- [ ] Audit all tool inputs for injection
- [ ] Validate file paths (no ../ traversal)
- [ ] Expand secret scanner patterns
- [ ] Add fuzzing tests for edge cases
- [ ] Document security model

**Success criteria**:
- Zero path traversal vulnerabilities
- All user inputs validated
- 50+ new secret patterns added
- Security tests pass

**Anticipated debt updates**:
- AGENT_PROFILE.md: Security strength ↑
- AGENT_METRICS.md: Security incidents = 0

---

### Iteration 2: Observability Foundation (P2)
**Risk**: Low
**Cost**: 2 days

**Tasks**:
- [ ] Create structured logger (trace/debug/info/warn/error)
- [ ] Replace all console.log with logger
- [ ] Add metrics collection to team ops
- [ ] Export metrics to JSON file per session

**Success criteria**:
- All logs structured (JSON lines)
- No console.log in production code
- Metrics collected for team runs
- Metrics export works

**Anticipated debt updates**:
- AGENT_METRICS.md: Observability ↑
- EVOLUTION.md: Add performance profiling needs

---

### Iteration 3: Performance Profiling (P2)
**Risk**: Medium (may uncover deep issues)
**Cost**: 3-4 days

**Tasks**:
- [ ] Profile team with 100 agents (stress test)
- [ ] Memory snapshot analysis for leaks
- [ ] Measure TUI re-render frequency
- [ ] Profile package manager operations
- [ ] Optimize todos tool pendingIndices (already O(1) but verify)

**Success criteria**:
- 100-agent team runs without lag >100ms
- No memory growth >10% over 1h
- TUI re-renders <10/second idle
- Identified top 3 bottlenecks

**Anticipated debt updates**:
- AGENT_METRICS.md: New performance metrics
- EVOLUTION.md: Bottleneck refactor plan

---

### Iteration 4: Testing Expansion (P5)
**Risk**: Low
**Cost**: 2-3 days

**Tasks**:
- [ ] Increase coverage to 80%+ (target weak modules)
- [ ] Add chaos testing (random network failures)
- [ ] Property-based tests for team claim algorithm
- [ ] 24h stability test (run team continuously)
- [ ] Reproducible test environment (Docker?)

**Success criteria**:
- Coverage ≥80% statement, ≥75% branch
- Chaos test passes (recovers from 30% failure rate)
- Property tests validate invariants
- 24h test shows <1% memory growth

**Anticipated debt updates**:
- AGENT_METRICS.md: Coverage ↑, stability ↑
- AGENT_PROFILE.md: Testing strength ↑

---

### Iteration 5: Documentation Sprint (P3)
**Risk**: Low
**Cost**: 2 days

**Tasks**:
- [ ] Write API reference for extension developers
- [ ] Create ADRs for key decisions (team, workspace, concurrency)
- [ ] Write CONTRIBUTING.md with workflow
- [ ] Improve inline JSDoc (all public APIs)
- [ ] Create tutorial for building custom tools

**Success criteria**:
- API docs auto-generated (typedoc)
- 5+ ADRs covering architecture
- CONTRIBUTING.md has setup/build/test instructions
- All public functions have JSDoc

**Anticipated debt updates**:
- AGENT_PROFILE.md: Documentation ↑
- TODO.md: Remove documentation gaps

---

### Iteration 6: Package Manager Refactor (P4)
**Risk**: High (core module)
**Cost**: 5-7 days

**Pre-conditions**: Iterations 1-5 complete

**Tasks**:
- [ ] Split `piclaw-package-manager.ts` into modules:
  - `parsing.ts` (source parsing, validation)
  - `install.ts` (install/remove logic)
  - `resolve.ts` (resource collection)
  - `settings.ts` (settings management)
- [ ] Extract `ResourceFilter` interface into its own file
- [ ] Add comprehensive tests for each module
- [ ] Preserve existing behavior fully

**Success criteria**:
- Each module <400 lines
- Tests still 100% passing
- Coverage maintained or improved
- No regressions in install/update/resolve

**Anticipated debt updates**:
- AGENT_PROFILE.md: Fragile modules ↓
- AGENT_METRICS.md: Complexity ↓, maintainability ↑

---

### Iteration 7: Team Manager Refactor (P4)
**Risk**: High
**Cost**: 5-7 days

**Pre-conditions**: Iteration 6 complete (pattern established)

**Tasks**:
- [ ] Extract `TaskQueue` class from `team-manager.ts`
- [ ] Extract `BackoffManager` class
- [ ] Extract `WorkspaceIntegration` (workspace ops)
- [ ] Extract `AgentStatusTracker` (heartbeat, liveness)
- [ ] Reassemble from modules in `team-manager.ts`

**Success criteria**:
- `team-manager.ts` becomes orchestrator (<200 lines)
- Each extracted module <300 lines
- Tests still 100% passing
- Performance not regressed

**Anticipated debt updates**:
- AGENT_PROFILE.md: Fragile modules ↓ (team-manager cleaned up)
- AGENT_METRICS.md: Complexity ↓

---

### Iteration 8: Lazy Extension Loading (P3)
**Risk**: Medium
**Cost**: 3-4 days

**Tasks**:
- [ ] Analyze current startup: all extensions active always
- [ ] Design lazy loading: load on first use
- [ ] Implement dynamic import for tools/commands/renderers
- [ ] Measure startup time improvement
- [ ] Add tests for lazy loading behavior

**Success criteria**:
- Startup time reduced by 30%+
- No functional regressions (all features still work)
- Memory footprint reduced
- Extensions load on-demand

**Anticipated debt updates**:
- AGENT_METRICS.md: Startup time ↓, memory usage ↓
- EVOLUTION.md: Consider WASM for hot paths

---

### Iteration 9: User Experience Improvements (P3)
**Risk**: Low
**Cost**: 2-3 days

**Tasks**:
- [ ] Improve error messages (actionable suggestions)
- [ ] Add `--verbose` flag for debug output
- [ ] Configuration discovery: `/config-help` command
- [ ] Session cleanup UI: `/sessions` list + delete
- [ ] Provider setup wizard: `/providers add` interactive

**Success criteria**:
- All errors include "how to fix" hint
- Debug mode shows stack traces, internal state
- Users can discover all config options in-app
- Can clean old sessions without file browser

**Anticipated debt updates**:
- AGENT_PROFILE.md: User experience ↑

---

### Iteration 10: Monitoring & Alerting (P4)
**Risk**: Medium
**Cost**: 4-5 days

**Tasks**:
- [ ] Build metrics TUI widget (real-time)
- [ ] Performance regression detection (compare to baseline)
- [ ] Health check endpoint (if web server added)
- [ ] Auto-report issues (optional telemetry)
- [ ] Alert on threshold breaches (memory, errors)

**Success criteria**:
- Widget shows live metrics (task rate, errors, memory)
- Can configure alert thresholds
- Regression detection flags >10% slowdown
- Optional telemetry respects privacy

**Anticipated debt updates**:
- AGENT_METRICS.md: Monitoring coverage ↑
- AGENT_PROFILE.md: Observability ↑

---

## 4. ANTICIPATED DEBT UPDATES

Each iteration will update:

1. **AGENT_METRICS.md**: Add new metrics, track deltas
2. **AGENT_PROFILE.md**: Update strengths/weaknesses
3. **EVOLUTION.md**: Document decisions, adjust trajectory
4. **TODO.md**: Remove completed, add new priorities

**Debt categories**:
- Technical (complexity, duplication)
- Security (vulnerabilities, validation)
- Testing (coverage, flaky tests)
- Documentation (API, ADRs)
- Performance (bottlenecks, memory)
- DX (errors, discoverability)
- Operational (CI/CD, monitoring)

---

## 5. RISK MANAGEMENT

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Refactor breaks existing behavior | Medium | High | Comprehensive tests, gradual migration |
| Performance regression | Medium | Medium | Profile before/after, benchmarks |
| Security vulnerability introduced | Low | High | Code review, security audit post-iteration |
| Team friction (blocking) | Low | Medium | Clear PR process, rollback plan |
| Over-engineering | Medium | Medium | Simplicity-first principle, regular review |

---

## 6. QUALITY GATES (Every Iteration)

Before marking iteration complete:
- [ ] All tests passing (100%)
- [ ] Type check clean
- [ ] Lint clean
- [ ] No new security issues
- [ ] Coverage not regressed
- [ ] Documentation updated
- [ ] Metrics recorded in AGENT_METRICS.md
- [ ] AGENT_PROFILE.md updated
- [ ] EVOLUTION.md updated

---

## 7. STOPPING CRITERIA

Evolution continues indefinitely, but may pause if:
- User requests feature freeze
- Critical production issue emerges
- Tests/builds failing and need clarification
- No actionable TODO items remaining (unlikely)

Resume by reading this doc, assessing current state, identifying next task.

---

## 8. SUCCESS METRICS

Long-term:
- ✅ System breaks less → fewer production incidents
- ✅ Fixes faster → MTTR ↓ over time
- ✅ Plans further ahead → fewer fire drills
- ✅ Fewer repeated mistakes → same bug not re-introduced

---

**END OF EVOLUTION PLAN**

*Next review: After iteration 1 (security audit)*
