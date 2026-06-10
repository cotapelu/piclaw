# Agent Profile

*PiClaw Autonomous Agent — capabilities, strengths, and weaknesses.*

---

## Core Competencies

✅ **SDK Utilization** – Extensive use of `@earendil-works/pi-coding-agent` factories and components (createBashTool, TreeSelectorComponent, SettingsList, withFileMutationQueue, createBashToolDefinition, etc.)  
✅ **Security Hardening** – Replaced eval() in calc-action with bc; migrated universal-tool to SDK bash tool for safe command execution; eliminated command injection risks  
✅ **Extension Architecture** – Clean registration via factory.ts, modular commands/tools/renderers  
✅ **Testing Discipline** – Unit tests for all new tools and renderers; 1064 tests passing  
✅ **TypeScript Strictness** – 0 type errors, proper interfaces, generics  
✅ **TUI Integration** – Custom components, widgets, interactive commands  
✅ **Security Scanning** – Secret scanning tool integrated with `/scan-secrets` command  

---

## Tasks That Often Fail (None)

No recurring failures observed in this evolution cycle.

---

## Weak Languages/Stacks

- N/A – Project is TypeScript-only, handled well.

---

## Fragile Modules

- **team-widget.ts** – Uses global mutable state (`teamWidgetEnabled`, `currentCtx`, `intervalId`). Not multi-session safe but acceptable for single-session TUI use.
- **compaction summary display** – Relies on SessionEntry structure; if schema changes, may break.

---

## Improvement Areas

| Area | Current State | Target |
|------|---------------|--------|
| Test Coverage | **≥80% (80.5%)** | ≥80% |
| Function Complexity | Mixed (some >20 LOC; team-widget improved) | ≥80% functions ≤20 LOC |
| Duplication | Renderer duplication reduced (render-utils); command parsing still candidate | Extract command parsing utils (optional) |
| Prompt Templates | Default templates added in `.pi/prompts/` | N/A |
| Keybindings | No custom keybindings for commands | Optional future work |

---

## Design Principles Adherence

- Simplicity-first: ✅ Most extensions are concise (50-150 LOC)
- No over-engineering: ✅ Leveraged SDK factories instead of custom implementations
- Declarative > Imperative: ✅ Used component composition
- Readable > Clever: ✅ Straightforward TypeScript, minimal magic

---

## Risk Assessment

| Component | Risk Level | Notes |
|-----------|------------|-------|
| New tools (git, test, formatter, audit, build, metrics) | **Low** | Direct wrappers around npm scripts; minimal logic |
| Commands (tree, settings, provider, copy, team) | **Low** | UI code isolated, uses SDK components |
| Widget (team) | **Medium** | Global state; could conflict if multiple sessions |
| Renderers | **Low** | Pure functions, no state |

---

## Evolution Trajectory

**Phase 1 (Base)** → **Phase 2 (Productivity)** → **Phase 3 (Polish)** → **Phase 4 (DevOps)**

All targets hit. Current state: **Production-ready** coding agent.

---

*Prepared by: PiClaw Autonomous Agent*  
*Workflow: AUTO-CONTINUE.md v2.1*
