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
- [x] Ensure 100% test pass rate (1000/1000)
- [x] Add ensurePiclawExtensionRegistered to main.ts

### Quality
- [x] TypeScript compile without errors
- [x] Build successful
- [x] All tests passing

---

## 🔄 IN PROGRESS

None currently.

---

## 📋 BACKLOG (Prioritized)

### P0 - High Impact, Low Effort
- [ ] Connect team widget to live team manager data
- [ ] Add team status refresh on events
- [ ] Custom renderer for system_info tool
- [ ] Custom renderer for branch summary (session tree)

### P1 - High Impact, Medium Effort
- [ ] Implement prompt template system (.pi/prompts/ loading, expansion)
- [ ] Build git tool (diff, log, status, commit) with renderDiff
- [ ] Settings panel UI (using SettingsSelectorComponent)
- [ ] Provider management command (`/providers list|add|remove|test`)
- [ ] File mutation queue integration (withFileMutationQueue wrapper)

### P2 - Medium Impact, Medium Effort
- [ ] Custom renderer for team_ops tool (task cards, agent status)
- [ ] Add test coverage for renderers (vitest)
- [ ] Implement prompt template caching
- [ ] Add autocomplete for prompt template names
- [ ] Export metrics to JSON (usage, performance)

### P3 - LowImpact, Low Effort
- [ ] Custom renderer for compaction summary
- [ ] Custom renderer for tool execution output (colorize)
- [ ] Add keyboard shortcut to toggle team widget
- [ ] Theme selector widget (quick theme switch)
- [ ] Add “copy last assistant response” command

### P4 - Stretch Goals
- [ ] Git diff viewer with syntax highlighting (use highlightCode)
- [ ] Build system integration (npm scripts runner)
- [ ] Test runner integration (vitest/jest output parser)
- [ ] Code formatter tool (prettier/biome integration)
- [ ] Dependency audit tool (npm audit wrapper)

---

## 🐛 KNOWN ISSUES

1. **Team widget static** – Not connected to live team data (P0)
2. **No prompt templates** – Manual prompts only (P1)
3. **No Git tool** – Users must use bash (P1)
4. **Settings only via JSON** – No interactive UI (P1)

---

## 📚 REFACTORING NEEDED

- [ ] Migration to File Mutation Queue: todos-tool, memory-tool
- [ ] Consolidate tool factories: ensure all custom tools use SDK patterns
- [ ] Reduce duplication in renderer error handling
- [ ] Extract common widget components (progress bars, lists)

---

## 🧪 TESTING GAPS

- [ ] Renderer unit tests (todos, memory, team)
- [ ] Integration tests for prompt template expansion
- [ ] End-to-end session branching with renderers
- [ ] Performance tests for large todos/memory lists
- [ ] Concurrency tests with mutation queue

---

## 📈 METRICS TARGETS

| Target | Current | Goal |
|--------|---------|------|
| Test Coverage | ~75% (est.) | ≥80% |
| Functions ≤20 LOC | TBD | ≥80% |
| Complexity ≤10 | TBD | ≥70% |
| Zero TypeScript Errors | ✅ | Maintain |
| Build Time | ~30s | <20s |

---

## 🔐 SECURITY CHECKLIST

- [x] No command injection in core tools
- [x] All file writes use validated paths (within cwd)
- [ ] Add secret scanning tool (detect API keys in outputs)
- [ ] Sandbox for untrusted extensions (future)
- [ ] Audit logging for sensitive operations (future)
- [ ] Rate limiting for external API calls (future)

---

*Workflow: AUTO-CONTINUE.md*  
*Status: Active – Continuous Evolution*
