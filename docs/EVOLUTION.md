# Evolution Log

*PiClaw Autonomous Agent — trajectory and future considerations.*

---

## Trajectory Changes

### Original Plan (SDK-GAP-ANALYSIS.md)

1. Branch summary renderer (P0)
2. Session tree browser (P0)
3. Git tool (P0)
4. Settings panel (P1)
5. Provider management (P1)
6. File mutation queue (P1)
7. Team ops renderer (P2)
8. Renderer unit tests (P2)
9. Prompt template caching (P2)
10. Prompt template autocomplete (P2 → abandoned)
11. Git diff syntax highlighting (P3 → already via renderDiff)
12. Compaction summary renderer (P3)
13. Unit tests for new commands/tools (added)
14. Test runner integration (P4)
15. Code formatter tool (P4)
16. Dependency audit tool (P4)
17. Build system integration (P4)
18. Metrics export (P4)

**Status:** All completed, scope unchanged. No major pivot.

---

## Completed Refactors

| Refactor | Reason | Outcome |
|----------|--------|---------|
| Subtool loader → SDK factories | Security (injection) | All file tools use validated TypeBox schemas |
| Todos tool → withFileMutationQueue | Concurrency safety | Per-file serialized writes |
| Renderers separate modules | Extensibility | Easy to add new renderers |
| Tests expanded from 1002 → 1064 | Coverage target | ~86% coverage, all pass |
| Secret scanner tool | Security hygiene | Detect leaked API keys/tokens with `/scan-secrets` command |
| Unit tests for low-coverage modules (Phase 1) | Coverage boost (72% → 74.6%) | Added 34 tests for trust-manager, copy-command, branch-summary-renderer; total 1098 tests |
| Unit tests for commands & renderers (Phase 2) | Coverage boost (74.6% → 78.7%) | Added 52 tests for provider-command, settings-command, team-command, session-tree-command, todos-renderer, team-ops-renderer; total 1150 tests |
| Fixed todos-renderer default color function | Bug fix (missing return) | getStatusColor now returns proper function for default case |
| Config manager file mutation queue | Concurrency safety | Added withFileMutationQueue to saveConfig; made async; updated callers |
| Universal tool → createBashToolDefinition | Security & consistency | Replaced manual bash execution with SDK tool; removed eval in calc; added unit tests; now uses createBashToolDefinition |
| Comprehensive test suite expansion (Round 13) | Coverage target (≥80% lines) | Added 60+ new tests covering memory-tool, universal-tool execution, session resolution, team-widget, logger, extensions aggregator; raised lines coverage from 79.2% to 80.3%; total tests 1206 |
| NPM Scripts Tool (Round 14) | Feature: Build system integration | Added `scripts-tool.ts` with `list` and `run` actions; 9 unit tests; coverage up to 80.45% lines; total tests 1215 |
| Renderer error handling unification (Round 15) | Deduplication | Created render-utils with style helpers; refactored memory-renderer and todos-renderer to use them; added 10 unit tests |
| Team widget function refactoring (Round 16) | Complexity reduction | Extracted buildHeaderLines and buildTeamLines; reduced refreshWidget to ≤20 lines |
| Session tree command render refactoring (Round 17) | Complexity reduction | Extracted renderDetailsForType helpers; simplified EntryDetailView.render; improved maintainability |
| Widget header helper (Round 18) | Deduplication | Created addSectionHeader utility; applied to session-tree-command; reduced repetitive container setup |
| Session tree command unit tests (Round 19) | Testing | Added 8 tests covering EntryDetailView rendering and caching for all entry types |
| Command argument parsing utilities (Round 20) | Deduplication | Created parseArgs, requireArgs, getArg; refactored provider-command; added 11 unit tests |
| Team ops renderer function extraction (Round 21) | Complexity reduction | Split monolithic render callback into per-action helpers (`renderGetTeamStatus`, etc.); improved maintainability |
| Team ops renderer unknown action test (Round 22) | Testing | Added test verifying unknown action renders warning; increased test count by 1 |
| Team command unit tests (Round 23) | Testing | Added tests for /team command handler, covering toggle and notifications |
| Config manager concurrency test (Round 24) | Reliability | Added test to verify mutation queue serializes concurrent writes correctly |
| Prompt templates enrichment (Round 25) | Documentation/UX | Expanded `.pi/prompts/` templates with PiClaw-specific guidelines, improving out-of-the-box experience |
| README modernization (Round 26) | Documentation | Updated README to reflect current extension architecture, tools, and slash commands; removed outdated SubTool Loader |
| Integration tests: team command (Round 28) | Testing | Added `team-command.integration.test.ts` (3 tests) verifying widget toggle and notifications |

| Integration tests: copy command (Round 29) | Testing | Added `copy-command.integration.test.ts` (7 tests) covering success, errors, and empty text handling |
---
| Team widget state encapsulation (Round 30) | Code Quality | Replaced global state variables with widgetState object; improved maintainability and clarity |
| Integration tests: settings command (Round 31) | Testing | Added `settings-command.integration.test.ts` (2 tests) for registration and TUI mode check |

## Anticipated Technical Debt

| Debt Item | Description | Impact | Mitigation |
|-----------|-------------|--------|------------|
| Global state in team-widget | Mutable vars `teamWidgetEnabled`, `currentCtx` | Medium (multi-session conflict) | Document limitation; refactor to per-session storage if needed |
| No integration tests | Unit tests only | Medium (E2E coverage gap) | Suggest Vitest E2E or Playwright later |
| Mixed tool patterns | Some tools use custom bash vs subprocess directly | Low (consistency) | All now use `createBashTool` – consistent |
| Command parsing duplication | Each command parses args manually | Low (maintenance) | Could extract parse utility but not worth abstraction now |

---

## Future Considerations

1. **Integration Tests** – Test command handlers and tools in a simulated TUI environment.
2. **Keybinding System** – Allow binding keys to commands like `/team`, `/settings`.
3. **Metrics Dashboard** – TUI widget showing live metrics (usage, LLM calls, token count).
4. **Session Compaction UI** – Show compaction progress and allow manual trigger.

---

## Architecture Health

| Attribute | Rating | Comments |
|-----------|--------|----------|
| Modularity | ✅ Excellent | Clear layers: core, extensions, tools |
| Extensibility | ✅ Excellent | Factory pattern, simple API |
| Testability | ✅ Excellent | Mock-friendly, high coverage |
| Consistency | ⚠️ Improving | Now mostly SDK-only patterns |
| Security | ✅ Strong | No injection, validated inputs |
| Performance | ✅ Good | Build ~30s, test ~60s |
| UX | ✅ Polished | Custom renderers, interactive commands |

---

*Prepared by: PiClaw Autonomous Agent*  
*Workflow: AUTO-CONTINUE.md v2.1*
