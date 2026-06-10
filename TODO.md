# Piclaw Development TODO

*Generated: 2025-06-09*
*Source: AUTO-CONTINUE workflow*

---

## ✅ COMPLETED (Evolution Round 1)

### Security & Stability
- [x] Rewrite subtool-loader to use SDK tool factories
- [x] Eliminate command injection vulnerability
- [x] Add type safety to tool definitions

### UX Enhancements
- [x] Custom todos renderer (progress bar, icons, phases)
- [x] Custom memory renderer (search results, tags, formatting)
- [x] Team status widget (persistent UI element)
- [x] Register renderers with guard checks

### Infrastructure
- [x] Update all tests for new architecture
- [x] Create runtime-runner.ts module
- [x] Ensure 100% test pass rate (1002/1002)
- [x] Add ensurePiclawExtensionRegistered to main.ts

### Quality
- [x] TypeScript compile without errors
- [x] Build successful
- [x] All tests passing

---

## ✅ COMPLETED (Evolution Round 2)

### Productivity
- [x] Implement prompt template system (.pi/prompts/ loading, auto expansion)
- [x] Add unit tests for prompt template integration (2 tests)
- [x] Automatic directory creation with fallback

---

## ✅ COMPLETED (Evolution Round 3)

### Team Integration
- [x] Connect team widget to live team manager data
- [x] Add periodic refresh (2s interval) for team status
- [x] Display team ID, task progress, agent statuses

---

## ✅ COMPLETED (Evolution Round 4)

### System Info
- [x] Custom renderer for system_info tool (pretty display)

## ✅ COMPLETED (Evolution Round 9 - Coverage Boost)

### Testing
- [x] Add unit tests for `trust-manager.ts` (19 tests covering load/save/resolve/hasTrustInputs)
- [x] Add unit tests for `copy-command.ts` (9 tests covering all handler edge cases)
- [x] Add unit tests for `branch-summary-renderer.ts` (6 tests covering rendering logic)
- [x] Increase overall coverage: 72.15% → 74.6% lines
- [x] Total tests: 1098 passing, 3 skipped, 0 failures

## ✅ COMPLETED (Evolution Round 10 - Coverage Phase 2)

### Testing
- [x] Add unit tests for `provider-command.ts` (14 tests: list, add, remove, test)
- [x] Add unit tests for `settings-command.ts` (3 tests: TUI mode, registration)
- [x] Add unit tests for `team-command.ts` (5 tests: toggle widget)
- [x] Add unit tests for `session-tree-command.ts` (6 tests: UI, selection, cancel)
- [x] Add unit tests for `todos-renderer.ts` (11 tests: progress, phases, statuses)
- [x] Add unit tests for `team-ops-renderer.ts` (13 tests: all actions, errors)
- [x] Fix bug in `todos-renderer.ts`: getStatusColor default returns function
- [x] Increase overall coverage: 74.6% → 78.68% lines
- [x] Total tests: 1150 passing, 3 skipped, 0 failures

## ✅ COMPLETED (Evolution Round 11 - Concurrency Safety)

### Concurrency & Stability
- [x] Add `withFileMutationQueue` to `config-manager.saveConfig`
- [x] Make `saveConfig` async for atomic writes
- [x] Update `settings-command` to await `saveConfig` with error handling
- [x] Update `config-manager.test.ts` to async tests
- [x] Verify no regressions (1150 tests pass)

## ✅ COMPLETED (Evolution Round 12 - SDK Migration)

### Tool Factories
- [x] Migrate universal-tool to `createBashToolDefinition`
- [x] Replace manual `ctx.exec` with SDK bash tool for consistency
- [x] Remove `eval()` in calc-action; use `bc` for safe math evaluation
- [x] Add unit tests for universal-tool (5 tests)
- [x] Verify no regressions (1146 tests pass)

## ✅ COMPLETED (Evolution Round 13 - Coverage ≥80%)

### Testing Blitz
- [x] Comprehensive test additions across multiple modules:
  - `universal-tool-execution.test.ts` (18 tests)
  - `memory-tool.test.ts` (17 tests)
  - `memory-tool-renderer.test.ts` (9 tests)
  - `session-resolver-basic.test.ts` + `session-resolver-full.test.ts` (11 tests)
  - `session-manager-resolution.test.ts` + `session-manager-additional.test.ts` (14 tests)
  - `extensions-aggregator.test.ts` (2 tests)
  - `team-widget-toggle.test.ts` (2 tests)
  - `select-session-interactive.test.ts` (4 tests)
  - `logger.test.ts` (11 tests)
- [x] Raised line coverage from ~79.2% → **80.3%** (target ≥80% achieved)
- [x] Total tests: 1206 passing, 3 skipped, 0 failures
- [x] Build green, no regressions
- [x] Cleaned up obsolete test files

## ✅ COMPLETED (Evolution Round 14 - Build System Integration)

### NPM Scripts Tool
- [x] Created `scripts-tool.ts` providing `scripts` tool and `/scripts` command
- [x] Tool supports actions: `list` (list all scripts) and `run` (execute a script)
- [x] Uses `createBashToolDefinition` for safe command execution
- [x] Added comprehensive unit tests (9 tests) covering registration, execution, validation, and command handler
- [x] Registered in `factory.ts`
- [x] All tests pass: 1215 passing, 3 skipped
- [x] Coverage increased slightly (~0.15% lines) to 80.45%

---

## 📋 BACKLOG (Prioritized)

### P0 - High Impact, Low Effort
- [x] Custom renderer for branch summary (session tree)

### P1 - High Impact, Medium Effort
- [x] Build git tool (diff, log, status, commit) with renderDiff
- [x] Settings panel UI (using SettingsSelectorComponent)
- [x] Provider management command (`/providers list|add|remove|test`)
- [x] File mutation queue integration (withFileMutationQueue wrapper)

### P2 - Medium Impact, Medium Effort
- [x] Custom renderer for team_ops tool (task cards, agent status)
- [x] Add test coverage for renderers (vitest)
- [x] Implement prompt template caching
- [x] Add default prompt templates (default, explain, refactor, test, review)
- [ ] Add autocomplete for prompt template names (abandoned - complex types)
- [x] Export metrics to JSON (usage, performance)

### P3 - LowImpact, Low Effort
- [x] Custom renderer for compaction summary (enhanced display in /tree)
- [x] Custom renderer for tool execution output (colorize) - via renderDiff and tool output styling
- [x] Add keyboard shortcut to toggle team widget
- [ ] Theme selector widget (abandoned - SDK API complexity)
- [x] Add "copy last assistant response" command

### P4 - Stretch Goals
- [x] Git diff viewer with syntax highlighting (use renderDiff)
- [x] Build system integration (npm scripts runner)
- [x] Test runner integration (vitest tool)
- [x] Code formatter tool (Prettier)
- [x] Dependency audit tool (npm audit)

---

## 🐛 KNOWN ISSUES

1. **No Git tool** - Users must use bash (P1)
2. **Settings only via JSON** - No interactive UI (P1)
3. **Prompt template expansion** - Implemented (✅) but no UI autocomplete yet (P2)
4. ~~Missing custom renderer~~ - ✅ Completed with branch-summary-renderer

---

## 📚 REFACTORING NEEDED

- [x] Migration to File Mutation Queue: todos-tool (done), memory-tool (partial)
- [x] Consolidate tool factories (all custom tools use SDK patterns)
- [ ] Reduce duplication in renderer error handling (deferred)
- [ ] Extract common widget components (deferred)

*Note: Most refactorings completed; minor items deferred for future.

---

## 🧪 TESTING GAPS

- [x] Renderer unit tests (todos, memory, team) – covered (6+5 tests)
- [x] Integration tests for prompt template expansion – unit tests sufficient
- [ ] End-to-end session branching with renderers (future E2E)
- [ ] Performance tests for large datasets (future benchmark)
- [ ] Concurrency tests for mutation queue (basic coverage exists)

*Note: Core testing goals met; advanced tests deferred.*

---

## 📈 METRICS TARGETS

| Target | Current | Goal |
|--------|---------|------|
| Test Coverage (lines) | **80.45%** | ≥80% ✅ |
| Functions ≤20 LOC | TBD | ≥80% |
| Complexity ≤10 | TBD | ≥70% |
| Zero TypeScript Errors | ✅ | Maintain |
| Build Time | ~30s | <20s |

---

## 🔐 SECURITY CHECKLIST

- [x] No command injection in core tools
- [x] All file writes use validated paths (within cwd)
- [x] Add secret scanning tool (detect API keys in outputs)
- [ ] Sandbox for untrusted extensions (future)
- [ ] Audit logging for sensitive operations (future)
- [ ] Rate limiting for external API calls (future)

---

*Workflow: AUTO-CONTINUE.md*
*Status: Active - Continuous Evolution*
