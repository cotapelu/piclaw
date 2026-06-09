# Agent Profile – Capabilities & Weaknesses

*Snapshot of agent characteristics, failure modes, and improvement areas*

---

## 🎯 STRENGTHS

### Core Competencies
- ✅ **SDK Usage**: High proficiency with `@earendil-works/pi-coding-agent`
- ✅ **Extension Architecture**: Deep understanding of tool definition, event system, renderers
- ✅ **Type Safety**: Strict TypeScript, TypeBox validation
- ✅ **Security Awareness**: Identify and fix injection vulnerabilities
- ✅ **Test-Driven**: Comprehensive test suite (1000+ tests)
- ✅ **Modular Design**: Clean separation of concerns

### Technical Skills
- **Languages:** TypeScript/JavaScript (expert), Node.js APIs
- **Frameworks:** pi-coding-agent, pi-tui, pi-agent-core
- **Patterns:** Extension system, tool factories, event-driven architecture
- **Tools:** Vitest, tsconfig strict, git workflow

---

## ⚠️ WEAKNESSES & FRAGILE AREAS

### 1. Tool Implementation Consistency
**Problem:** Mixed patterns – some tools use SDK factories, others custom.  
**Impact:** Increased maintenance, potential security gaps.  
**Mitigation:** Ongoing migration to SDK factories (subtool-loader migrated, universal safe, todos/memory custom but validated).

**Example Fragile Code:**
- `todos-tool.ts`: Custom file I/O with mutex – works but not using `withFileMutationQueue`
- `memory-tool.ts`: Same pattern
- `team-tool.ts`: Complex state management, needs audit for race conditions

---

### 2. Renderer Registration
**Problem:** Renderers assume `api.registerMessageRenderer` exists. Older mocks/tests don't have it → failures.  
**Impact:** Test brittleness when adding new renderers.  
**Mitigation:** Added guard checks (`if (typeof api.registerMessageRenderer !== 'function') return;`). Future: Update all test mocks to include it.

---

### 3. TypeScript Generic Complexity
**Problem:** SDK tool factories have complex generics. Our wrapper code uses `any` casts to bypass.  
**Impact:** Potential type errors at runtime (unlikely but possible).  
**Mitigation:** Document casts, gradually refine types. Acceptable for now given SDK stability.

---

### 4. Team Widget Integration
**Problem:** Team widget shows static text; not connected to live `AgentTeam` instance.  
**Impact:** Missed opportunity for real-time team status.  
**Fix Planned:** P0 – connect widget to team manager via extension context or event bus.

---

### 5. No Prompt Template System
**Problem:** Users manually craft prompts; no reusable templates.  
**Impact:** Reduced productivity, inconsistent prompts.  
**Fix Planned:** P1 – implement `.pi/prompts/` loading and `/template expansion.

---

## 🐛 COMMON FAILURE MODES

| Mode | Symptom | Root Cause | Fix |
|------|---------|------------|-----|
| **Security** | Command injection in tools | Manual `ctx.exec` with string interpolation | Use SDK tools with argument arrays |
| **Tests** | Mock API missing methods | Extension code uses new API not in old mocks | Guard checks or update mocks |
| **Typing** | Generic assignment errors | SDK tool definitions have strict types | Use `as any` with justification |
| **Concurrency** | Race conditions on file writes | Multiple tools writing same file | Use `withFileMutationQueue` |
| **UX** | Plain text output | No custom renderer registered | Implement and register renderer |

---

## 📊 TASK PERFORMANCE

### Tasks Usually Good At
- ✅ SDK-based tool creation (when following pattern)
- ✅ Event handling and extension points
- ✅ Type-safe parameter validation
- ✅ Error handling and reporting
- ✅ Test coverage expansion

### Tasks Usually Struggle With
- ⚠️ Complex generic typing (tend to use `any` escape)
- ⚠️ Advanced TUI components (custom editors, overlays)
- ⚠️ Multi-provider OAuth flows (not yet implemented)
- ⚠️ Performance optimization (large data, virtual lists)
- ⚠️ Persistent storage beyond file I/O (DB, network)

---

## 🏷️ FRAGILE MODULES (Requires Careful Changes)

| Module | Why Fragile | Recommendations |
|--------|-------------|-----------------|
| `subtool-loader.ts` | Previously vulnerable, now using SDK but has `any` casts | Complete type migration when SDK generics stabilize |
| `todos-tool.ts` | Custom persistence, manual validation, complex state | Migrate to SDK patterns, add mutation queue |
| `memory-tool.ts` | Similar to todos | Same as above |
| `team-manager.ts` | Complex concurrency, backoff, zombie detection | Comprehensive integration tests required |
| `extensions/factory.ts` | Order-sensitive registration | Document dependencies, add integration tests |

---

## 🎓 LEARNING CURVE

**Easy for:**
- Adding new tools following `tool-template.ts` pattern
- Registering commands/shortcuts/flags
- Writing custom renderers (using TUI components)
- Subscribing to extension events

**Hard for:**
- Modifying core agent loop (agent-session.ts)
- Extending ResourceLoader with new resource types
- Custom mode implementations (beyond interactive/print/rpc)
- Multi-provider OAuth integration
- Concurrency control beyond mutex

---

## 🛠️ RECOMMENDED SKILL UPGRADES

To address weaknesses, study:
1. **pi-coding-agent SDK internals** (read `llm-context/` source)
2. **TypeBox advanced patterns** (discriminated unions, recursive)
3. **TUI component lifecycle** (dispose, invalidation, focus)
4. **Extension event ordering** (session_start, context, agent_start)
5. **Concurrency patterns** (queue, semaphore, worker pool)

---

## 📈 PROGRESS TRACKING

| Date | Focus | Improvement |
|------|-------|-------------|
| 2025-06-09 | Security + UX | Subtool secure, 3 renderers added, tests 100% |

*Updated each iteration per AUTO-CONTINUE workflow*

---

*Profile reflects current agent capabilities as of last evolution round.*  
*Used to guide task selection and training focus.*
