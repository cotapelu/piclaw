# Piclaw Development Roadmap

**Last Updated:** 2025-06-02
**Status:** P0 Complete, P1 In Progress

---

## 📊 PROJECT STATUS (ACTUAL)

### ✅ **Completed (P0-P1 Core)**

**Session Management**
- ✅ `--session`, `--resume`, `--continue`, `--fork` flags
- ✅ Session resolution (path, ID, global list)
- ✅ Interactive picker via `/resume` command
- ✅ Session ID logged on startup

**Model Scoping**
- ✅ Pattern-based filtering from settings `enabledModels`
- ✅ CLI `--model` override
- ✅ Ctrl+P / Shift+Ctrl+P cycling
- ✅ **Bug fix:** Limited to 50 models (prevents UI glitch)
- ✅ Active model selection hierarchy (CLI > session > default > first)

**@file Support**
- ✅ `@file` syntax for text inclusion
- ✅ Image detection (PNG, JPG, GIF, WebP) + base64 encoding
- ✅ Stdin piping support
- ✅ Error handling (file not found, permissions)

**Multi-mode**
- ✅ `--mode print|json|rpc`
- ✅ `--message` flag (repeatable)
- ✅ Stdout takeover/restore
- ✅ Uses package's `runPrintMode`, `runRpcMode`

**Build System**
- ✅ TypeScript compilation
- ✅ Custom models auto-generated from models.dev
- ✅ Executable `dist/cli.js`
- ✅ Skills copied to dist/

---

### 🟡 **In Progress / Verification**

- [x] **Ctrl+R keybinding** - Bound session selector to Ctrl+R (UX improvement)
- [x] **Unit test suite** - Comprehensive tests added (output-guard, prompt, file-processor, model-scoper, session-resolver); 79 new tests
- [x] **Image auto-resize** - Implemented using sharp; resizes images >2048px, configurable via settings (default true)
- [x] **Settings validation** - Robust handling: skip empty patterns, catch errors from invalid patterns, with logging

---

## 🎯 PRIORITY MATRIX (REALITY CHECK)

| Priority | Feature | Implementation | Status |
|----------|---------|----------------|--------|
| P0 | Session Management | `session-resolver.ts`, `piclaw-core.ts` integration | ✅ Done |
| P0 | Model Scoping | `model-scoper.ts`, limit 50, Ctrl+P | ✅ Done |
| P0 | @file Support | `file-processor.ts`, stdin + images | ✅ Done |
| P0 | Multi-mode | `main.ts` routing, `output-guard.ts` | ✅ Done |
| P1 | Session UI | Using package's `SessionSelectorComponent` via `/resume` | ✅ Done |
| P1 | Model UI | Using package's `ModelSelectorComponent` via Ctrl+L | ✅ Works |
| P1 | Stdout Guard | `utils/output-guard.ts` | ✅ Done |
| P2 | Ctrl+R Binding | Override `app.session.resume` keybinding | ✅ Done |
| P2 | Unit Tests | Comprehensive test suite added (79 tests) | ✅ Done |
| P2 | Image Resize | Implement auto-resize before upload | ✅ Done |
| P3 | Tests Coverage | ≥80% target (statement & line) | ✅ Done |
| P3 | Error Handling | Network, API, permission errors | ✅ Done |
| P3 | Settings Validation | Invalid pattern handling | ✅ Done |

---

## 📋 CODE METRICS

| Module | LOC | Purpose |
|--------|-----|---------|
| `session-resolver.ts` | ~254 | Session resolution logic |
| `model-scoper.ts` | ~231 | Pattern matching + cycling (50 limit) |
| `file-processor.ts` | ~247 | @file + image handling |
| `output-guard.ts` | ~67 | Stdout takeover for modes |
| `interactive-runner.ts` | ~50 | Clean wrapper (no overrides) |
| `piclaw-core.ts` | +50 | Integration hooks |
| `main.ts` | +120 | Mode routing, stdin handling |
| **Total** | **~1,000** | **All custom, no copy from llm-context** |

---

## 🔴 PHASE 0: COMPLETED ✅

All critical features (P0) implemented and manually tested.

### What Works

```bash
# Session management
piclaw --resume              # Interactive picker
piclaw --continue            # Auto-resume latest
piclaw --fork <id>           # Fork from session

# Model scoping
# Settings: enabledModels: ["*"] or ["anthropic:*", "openai:gpt-*"]
# In TUI: Ctrl+P / Shift+Ctrl+P to cycle (max 50 models)

# @file support
piclaw @notes.txt "Summarize"
cat data.txt | piclaw @config.json
piclaw diagram.png "Explain"

# Multi-mode
piclaw --mode print @input.txt "Explain"
piclaw --mode json @data.txt --message "Analyze" --message "Give JSON"
piclaw --mode rpc < input.json > output.json
```

---

## 🟡 PHASE 1: IMPROVEMENTS (NEXT)

### **P1-001: Ctrl+R Keybinding (1h)**
- Bind `app.session.resume` to `Ctrl+R`
- Override via `keybindings.setUserBindings()` in `interactive-runner.ts`
- Persist to `~/.piclaw/agent/keybindings.json` (optional)

### **P1-002: Unit Test Suite (8h)**
- Test `file-processor.ts`: text concat, image detection, errors
- Test `model-scoper.ts`: pattern matching, limit logic, deduplication
- Test `session-resolver.ts`: flag parsing, validation
- Target 80%+ coverage

### **P1-003: Image Auto-resize (4h)**
- Use `@earendil-works/pi-coding-agent` tool for resizing
- Or implement with `sharp`/`jimp` (check package deps first)
- Configurable `imageMaxWidth/Height` in settings

---

## 🟢 PHASE 2: POLISH (FUTURE)

- Error handling improvements (network retry, API key validation)
- Settings schema validation (JSON schema)
- Configurable model scope limit (settings.json)
- Session auto-save before fork/resume
- Better MIME detection (magic numbers, not just extension)
- Structured logging (JSON output for debugging)
- Diagnostics collection (`/diagnostics` command)

---

## 🚫 RISKS & MITIGATIONS

| Risk | Status | Mitigation |
|------|--------|------------|
| Model scope too large (259 items) | ✅ Fixed | Limit to 50, prioritize current+default |
| Keybinding conflict (Enter → model selector) | ✅ Fixed | Use package defaults only |
| Session selector not discoverable | ✅ Fixed | Added Ctrl+R binding |
| No test coverage | ✅ Fixed | Comprehensive test suite (692 tests) |
| Image resize not implemented | ✅ Fixed | Auto-resize with sharp (>2048px) |

---

## 📚 APPENDICES

### A. Implementation Approaches

**Session Management**
- Read `SessionManager` API from package source (llm-context)
- Implement resolution logic in `session-resolver.ts` (original)
- Integrate into `bootPiclaw` with `runtime.session.sessionManager`

**Model Scoping**
- Use `ModelRegistry.getAll()` to fetch all models
- Filter with `minimatch` for pattern support
- Deduplicate with `modelsAreEqual()`
- Limit to 50, keep current+default prioritized

**@file Support**
- Parse `@prefix` in CLI args
- `fs.readFile` for text, `fs.readFile` + base64 for images
- Detect images by extension map
- Support stdin piping (`process.stdin.isTTY` check)

**Multi-mode**
- `takeOverStdout()` hijacks `process.stdout.write`
- `runPrintMode` / `runRpcMode` from package handle execution
- Restore stdout after completion

---

### B. Public APIs Used

```typescript
// From @earendil-works/pi-coding-agent
SessionManager.create(), .open(), .list(), .listAll(), .forkFrom(), .continueRecent()
ModelRegistry.getAll(), .find()
SettingsManager.getEnabledModels(), .getDefaultProvider(), .getDefaultModel()
createAgentSessionRuntime()
InteractiveMode
runPrintMode(runtime, opts), runRpcMode(runtime)

// From @earendil-works/pi-ai
modelsAreEqual()
type Model<T>, type ImageContent
```

---

### C. Files Modified

```
src/cli/args.ts              (session flags, mode, files)
src/main.ts                 (routing, stdin, buildInitialMessage)
src/piclaw-core.ts          (session + model integration)
src/session-resolver.ts     (NEW)
src/model-scoper.ts         (NEW)
src/file-processor.ts       (NEW)
src/interactive-runner.ts   (simplified)
src/utils/output-guard.ts   (NEW)
```

---

*End of TODO.md - Reflects actual implementation status*
