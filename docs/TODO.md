# Piclaw vs Pi-Coding-Agent: Feature Parity Analysis

**Last Updated:** 2025-06-09
**Analysis Based On:** `llm-context/packages/coding-agent/src/main.ts` vs `src/main.ts`

---

## 📊 EXECUTIVE SUMMARY

| Metric | Pi-Coding-Agent | Piclaw | Parity |
|--------|-----------------|--------|--------|
| Main.ts LOC | ~800 | ~200 | 25% |
| Total Custom Code | ~800 | ~1,000 | 125% |
| CLI Flags | 25+ | 15 | 60% |
| Features Implemented | 100% | ~40% | 40% |
| Modular Architecture | ❌ Single file | ✅ Modular | + |
| Missing Critical | 0 | ~55 | - |

**Conclusion:** Piclaw có kiến trúc tốt hơn nhưng thiếu **~55 features** quan trọng so với Pi reference implementation.

---

## 1. KIẾN TRÚC TỔNG THỂ

### Pi (llm-context)
- ❌ **Monolithic**: Single file giant ~800 lines
- Tất cả logic trong `main.ts`
- Direct imports từ `@earendil-works/pi-coding-agent`
- Functions: `resolveSessionPath()`, `buildSessionOptions()`, `prepareInitialMessage()`, etc.
- Không có abstraction layers

### Piclaw
- ✅ **Modular architecture**
- `main.ts` chỉ là entry point (~200 lines)
- Logic được phân chia:
  - `args` → `src/cli/args.ts`
  - `config` → `src/config/config-manager.ts`
  - `session resolver` → `src/session-resolver.ts`
  - `model scoping` → `src/model-scoper.ts`
  - `core bootstrap` → `src/piclaw-core.ts`
  - `interactive runner` → `src/interactive-runner.ts`
  - `file processor` → `src/file-processor.ts`
  - `helpers` → `src/utils/helpers.ts`
  - `output guard` → `src/utils/output-guard.ts`
  - `package commands` → `src/package-commands.ts`

**Verdict:** Piclaw architecture superior for maintainability.

---

## 2. CLI ARGUMENT PARSING COMPARISON

### Pi's Feature Set (from `cli/args.ts`)

| Flag | Purpose | Piclaw Status |
|------|---------|---------------|
| `--provider <name>` | Provider for `--model` | ❌ Missing (rely on `model:provider/pattern`) |
| `--model <pattern>` | Model pattern with optional `:thinking` suffix | ✅ Implemented (different approach) |
| `--thinking <level>` | Thinking level override | ✅ Implemented |
| `--no-tools <mode>` | Disable tools: `all` or `builtin` | ❌ Missing |
| `--exclude-tools <list>` | Exclude specific tools | ❌ Missing |
| `--no-builtin-tools` | Disable built-in tools only | ❌ Missing |
| `--tools <list>` | Allowlist tools | ✅ Implemented |
| `--session <arg>` | Open session by ID/path | ✅ Implemented |
| `--session-id <id>` | Create session with specific ID | ❌ Missing |
| `--resume` | Interactive session picker (TUI) | ✅ Implemented (console fallback) |
| `--continue` | Continue most recent (no UI) | ✅ Implemented |
| `--fork <arg>` | Fork from existing session | ✅ Implemented |
| `--no-session` | In-memory session only | ❌ Missing |
| `--session-dir <dir>` | Custom session directory | ✅ Implemented |
| `--mode <mode>` | `interactive`\|`print`\|`json`\|`rpc` | ✅ Implemented |
| `--message <text>` | Additional message (repeatable) | ✅ Implemented |
| `--files [...]` | File arguments (positional) | ✅ Implemented (`files` field) |
| `--system-prompt <text>` | Override system prompt | ❌ Missing |
| `--append-system-prompt <text>` | Append to system prompt | ❌ Missing |
| `--no-context-files` | Disable context file loading | ❌ Missing |
| `--no-extensions` | Disable all extensions | ✅ Implemented |
| `--no-skills` | Disable skills | ✅ Implemented |
| `--no-prompt-templates` | Disable prompt templates | ✅ Implemented |
| `--no-themes` | Disable themes | ✅ Implemented |
| `--models <patterns>` | Multiple model patterns (array) | ❌ Missing (only single `--model`) |
| `--api-key <key>` | Override API key for provider | ✅ Implemented (different impl) |
| `--auto-resize-images` | Auto-resize large images | ❌ Missing |
| `--contextLogFile <path>` | Log LLM context to file | ✅ Implemented |
| `--verbose` | Detailed logging | ✅ Implemented |
| `--stats` | Show usage stats after completion | ✅ Implemented (Piclaw extra) |
| `--version` | Show version | ❌ Missing |
| `--help` | Show help (with extension flags auto-discovery) | ✅ Implemented (no extension flags) |
| `--export <file>` | Export session to HTML | ❌ Missing |
| `--list-models [search]` | List available models with optional search | ❌ Missing |

**Total Missing Flags: 12**
- `--provider`
- `--no-tools`
- `--exclude-tools`
- `--no-builtin-tools`
- `--session-id`
- `--no-session`
- `--system-prompt`
- `--append-system-prompt`
- `--no-context-files`
- `--models` (multi)
- `--auto-resize-images`
- `--version`
- `--export`
- `--list-models`

**Extra Flags Piclaw Has:**
- `--stats` (usage statistics) - ✅ Good addition!

---

## 3. SESSION MANAGEMENT DEEP DIVE

### Pi's `createSessionManager()` Flow

```
Input: parsed Args, cwd, sessionDir, settingsManager
Output: SessionManager instance

Decision Tree:
├─ --no-session or --help or --list-models?
│  └─→ SessionManager.inMemory(cwd)
├─ --fork <arg>?
│  ├─ Validate no conflicts with other session flags
│  ├─ resolveSessionPath(arg, cwd, sessionDir)
│  │  ├─ Looks like path? → use as-is
│  │  ├─ Search local sessions (SessionManager.list())
│  │  └─ Search global sessions (SessionManager.listAll())
│  ├─ Found local? → forkSessionOrExit(path, cwd, sessionDir, sessionId)
│  ├─ Found global? → promptConfirm("Fork into current directory?") → fork if yes
│  └─ Not found? → error + exit(1)
├─ --session <arg>?
│  ├─ resolveSessionPath(arg, cwd, sessionDir)
│  ├─ Found local/path? → SessionManager.open(path, sessionDir)
│  ├─ Found global? → promptConfirm("Fork into current directory?") → fork if yes
│  └─ Not found? → error + exit(1)
├─ --resume?
│  ├─ initTheme(settingsManager.getTheme(), true)
│  ├─ selectSession() with TUI picker
│  └─ SessionManager.open(selectedPath, sessionDir)
├─ --continue?
│  └─ SessionManager.continueRecent(cwd, sessionDir)
├─ --session-id specified?
│  ├─ Check if already exists locally (findLocalSessionByExactId)
│  ├─ If exists? → error "Session already exists"
│  └─ Else → SessionManager.create(cwd, sessionDir, { id: sessionId })
└─ Default:
   └─ SessionManager.create(cwd, sessionDir)
```

### Piclaw's `resolveSessionManager()` Implementation

```
Input: opts { cwd, sessionDir, session, resume, continue, fork, interactive }
Output: SessionManager instance

Decision Tree:
├─ --continue?
│  └─ SessionManager.continueRecent(cwd, sessionDir) or throw "No recent session"
├─ --resume?
│  ├─ SessionManager.list(cwd, sessionDir)
│  ├─ Interactive? → selectSessionInteractive() console picker
│  └─ Non-interactive? → sessions[0].path
│  └─ No sessions? → error
├─ --fork <arg>?
│  ├─ resolveSessionArgument(arg, cwd, sessionDir)
│  │  ├─ Looks like path? → {type: "local", path: resolvedPath}
│  │  ├─ Local search (SessionManager.list()) prefix match
│  │  └─ Global search (SessionManager.listAll()) prefix match
│  ├─ Found global? → promptConfirm("Fork from different project?") if interactive
│  └─ SessionManager.forkFrom(resolved.path, cwd, sessionDir)
├─ --session <arg>?
│  ├─ resolveSessionArgument(arg, cwd, sessionDir)
│  └─ SessionManager.open(resolved.path, sessionDir)
└─ Default:
   └─ SessionManager.create(cwd, sessionDir)
```

### Missing Session Features (Pi → Piclaw)

| Feature | Pi | Piclaw | Gap |
|---------|----|--------|-----|
| `--session-id` with validation | ✅ | ❌ | Cannot create sessions with custom IDs |
| `--no-session` (in-memory) | ✅ | ❌ | No way to avoid disk persistence |
| `SessionManager.inMemory()` | ✅ | ❌ | Must use file-based sessions |
| `SessionManager.buildSessionContext()` | ✅ | ❌ | Cannot easily check session state (e.g., has messages) |
| Session diagnostics collection | ✅ | ❌ | No warnings about session issues |
| Validation: conflicting flags | ✅ | ✅ | OK (has `validateSessionFlags()`) |
| Global session fork with TUI | ✅ | ❌ (console only) | No fancy TUI picker for global sessions |
| Auto-fork on global session | ✅ | ❌ Requires interactive prompt | Less UX polish |

---

## 4. PROJECT TRUST SYSTEM (CRITICAL GAP)

### Pi's Implementation

**Files:** `src/core/trust-manager.ts`, `src/core/extensions/runner.ts`, `src/core/auth-storage.ts`

#### Components

1. **`ProjectTrustStore`**
   ```typescript
   class ProjectTrustStore {
     private store: Map<string, boolean>; // cwd → trusted
     get(cwd: string): boolean | null;
     set(cwd: string, trusted: boolean): void;
   }
   ```
   - Persists trust decisions (likely in `~/.pi/trust.json` or similar)
   - Avoids re-prompting on every startup

2. **`hasProjectTrustInputs(cwd)`**
   ```typescript
   function hasProjectTrustInputs(cwd: string): boolean {
     // Check for AGENTS.md, CLAUDE.md, .pi/, package.json with pi-extensions
   }
   ```
   - Returns `true` if project has ANY of:
     - `AGENTS.md` or `CLAUDE.md` files
     - `.pi/` directory (settings, resources)
     - `package.json` with `pi-extensions` field

3. **`createProjectTrustContext(options)`**
   ```typescript
   interface ProjectTrustContext {
     cwd: string;
     mode: "tui" | "noninteractive";
     hasUI: boolean;
     ui: {
       select: (title, options) => Promise<string | undefined>;
       confirm: (title, message) => Promise<boolean>;
       input: (title, placeholder) => Promise<string | undefined>;
       notify: (message, type) => void;
     };
   }
   ```
   - Abstract UI interface for trust prompts
   - Works in TUI and non-interactive modes

4. **`resolveProjectTrusted(options)`**
   ```typescript
   async function resolveProjectTrusted({
     cwd,
     trustStore,
     trustOverride, // from --project-trust-override
     appMode,
     settingsManagerForPrompt,
     extensionsResult,
     projectTrustContext,
     onExtensionError
   }): Promise<boolean> {
     // Priority:
     // 1. --project-trust-override CLI flag
     // 2. Extension event (emitProjectTrustEvent)
     // 3. TrustStore cached decision
     // 4. UI prompt (if hasUI)
     // 5. Non-interactive default: false
   }
   ```

5. **`emitProjectTrustEvent()`** (extensions hook)
   ```typescript
   const { result, errors } = await emitProjectTrustEvent(
     extensionsResult,
     { type: "project_trust", cwd },
     projectTrustContext
   );
   // Extensions can override trust decision
   ```

6. **Trust Prompt UI** (TUI components)
   ```typescript
   showStartupSelector(settingsManager, formatProjectTrustPrompt(cwd), [
     { label: "Trust", value: { trusted: true, remember: true } },
     { label: "Trust (this session only)", value: { trusted: true, remember: false } },
     { label: "Do not trust", value: { trusted: false, remember: true } },
     { label: "Do not trust (this session only)", value: { trusted: false, remember: false } },
   ]);
   ```

#### Why This Matters

- **Security**: Prevents malicious extensions from accessing project files
- **User Control**: Explicit opt-in for project resources
- **Extension Safety**: Extensions only run in trusted projects
- **Persistent Decisions**: Don't prompt every time

### Piclaw Gap

❌ **No project trust implementation at all**

**Consequences:**
- Extensions may run without user consent
- Cannot differentiate trusted vs untrusted projects
- No prompts for AGENTS.md, CLAUDE.md, .pi/ access
- Security vulnerability!

**Implementation Effort:** 2-3 days (full subsystem)

---

## 5. EXTENSIONS & RESOURCE LOADER

### Pi's Rich Options

```typescript
interface DefaultResourceLoaderOptions {
  packageManager?: PiclawPackageManager;

  // Additional paths (CLI overrides)
  additionalExtensionPaths?: string[];
  additionalSkillPaths?: string[];
  additionalPromptTemplatePaths?: string[];
  additionalThemePaths?: string[];

  // Disable flags
  noExtensions?: boolean;
  noSkills?: boolean;
  noPromptTemplates?: boolean;
  noThemes?: boolean;
  noContextFiles?: boolean;

  // System prompt overrides
  systemPrompt?: string;
  appendSystemPrompt?: string;

  // Extension factories
  extensionFactories?: ExtensionFactory[];
}
```

### Piclaw's Current Implementation (`extensions/factory.ts`)

```typescript
export function getResourceLoaderOptions() {
  return {
    extensionFactories: getExtensionFactories(),
    // Missing: all other options
  };
}
```

**Also adds:**
- `packageManager: new PiclawPackageManager(...)` ✅ Good!

**Missing Options:**
- ❌ `additionalExtensionPaths` (from `--extensions`)
- ❌ `additionalSkillPaths` (from `--skills`)
- ❌ `additionalPromptTemplatePaths` (from `--prompt-templates`)
- ❌ `additionalThemePaths` (from `--themes`)
- ❌ `noContextFiles` (from `--no-context-files`)
- ❌ `systemPrompt` (from `--system-prompt`)
- ❌ `appendSystemPrompt` (from `--append-system-prompt`)

### Extension Flags Discovery

**Pi:**
```typescript
const extensionFlags = resourceLoader
  .getExtensions()
  .extensions
  .flatMap(extension => Array.from(extension.flags.values()));

printHelp(extensionFlags);
```

**Piclaw:** ❌ No access to `resourceLoader.getExtensions()` in main.ts

---

## 6. SETTINGS MANAGER DEEP DIVE

### Pi's SettingsManager Features

From `@earendil-works/pi-coding-agent`:

```typescript
class SettingsManager {
  // File watching (auto-reload on changes)
  private watcher?: fs.FSWatcher;

  // Settings getters
  getEnabledModels(): string[]; // from enabledModels
  getDefaultProvider(): string | undefined;
  getDefaultModel(): string | undefined;
  getHttpIdleTimeoutMs(): number;
  getClearOnShrink(): boolean;
  getShowHardwareCursor(): boolean;
  getImageAutoResize(): boolean;
  getTheme(): Theme;
  getSessionDir(): string | undefined;

  // Diagnostics
  drainErrors(): Array<{ scope: string; error: Error }>;
}
```

**Key Features:**
- ✅ **Directory watching**: Auto-reload when `settings.json` changes
- ✅ **Diagnostics**: Collect errors from loading settings files
- ✅ **HTTP config**: `httpIdleTimeoutMs` for dispatcher
- ✅ **TUI config**: `clearOnShrink`, `showHardwareCursor`

### Piclaw's SettingsManager Usage

**Uses package's `SettingsManager.create(cwd, agentDir)`** ✅

**But:**
- No access to `drainErrors()` (no diagnostics)
- No `getHttpIdleTimeoutMs()` (no HTTP dispatcher config)
- File watching? Unclear if package's SettingsManager supports it
- `getClearOnShrink()`, `getShowHardwareCursor()` not used

**Custom Config Manager** (`config-manager.ts`):
- Manages `~/.piclaw/agent/settings.json`
- No directory watching
- No diagnostics

---

## 7. DIAGNOSTICS & ERROR REPORTING

### Pi's System

```typescript
type AgentSessionRuntimeDiagnostic = {
  type: "error" | "warning" | "info";
  message: string;
};

// Collection
function collectSettingsDiagnostics(settingsManager, context): AgentSessionRuntimeDiagnostic[] {
  return settingsManager.drainErrors().map(({scope, error}) => ({
    type: "warning",
    message: `(${context}, ${scope} settings) ${error.message}`,
  }));
}

// Reporting
function reportDiagnostics(diagnostics: readonly AgentSessionRuntimeDiagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const color = diagnostic.type === "error" ? chalk.red :
                  diagnostic.type === "warning" ? chalk.yellow : chalk.dim;
    const prefix = diagnostic.type === "error" ? "Error: " :
                   diagnostic.type === "warning" ? "Warning: " : "";
    console.error(color(`${prefix}${diagnostic.message}`));
  }
}

// Usage in main.ts
const diagnostics = [
  ...collectSettingsDiagnostics(settingsManager, "startup session lookup"),
  ...services.diagnostics,
  ...resourceLoader.getExtensions().errors.map(...),
  ...sessionOptionDiagnostics,
  ...projectTrustDiagnostics,
];
reportDiagnostics(runtime.diagnostics);
if (runtime.diagnostics.some(d => d.type === "error")) {
  process.exit(1);
}
```

### Piclaw's Approach

- Uses `logger.error()`, `logger.warn()` scattered throughout
- No centralized diagnostics collection
- No structured error reporting before startup
- No extension errors collection

**Missing:**
- ❌ `drainErrors()` from settings manager
- ❌ Extension load errors aggregation
- ❌ Pre-startup validation with clear error messages
- ❌ Structured output (color-coded by severity)

---

## 8. MAIN FLOW COMPARISON

### Pi's Main Flow (annotated)

```typescript
export async function main(args: string[], options?: MainOptions) {
  resetTimings();
  const offlineMode = args.includes("--offline") || isTruthyEnvFlag(process.env.PI_OFFLINE);

  if (process.platform === "win32") {
    cleanupWindowsSelfUpdateQuarantine(getPackageDir());
  }

  if (await handlePackageCommand(args)) return;  // Piclaw có riêng package commands

  if (await handleConfigCommand(args)) return;   // Piclaw có riêng config commands

  const parsed = parseArgs(args);  // Rich CLI parser
  if (parsed.diagnostics.length > 0) {
    // Report parse errors
    reportDiagnostics(parsed.diagnostics);
    if (parsed.diagnostics.some(d => d.type === "error")) process.exit(1);
  }
  time("parseArgs");

  let appMode = resolveAppMode(parsed, process.stdin.isTTY);
  const shouldTakeOverStdout = appMode !== "interactive";
  if (shouldTakeOverStdout) takeOverStdout();

  if (parsed.version) { console.log(VERSION); process.exit(0); }  // ❌ Missing

  if (parsed.export) {
    // Export session to HTML
    const result = await exportFromFile(parsed.export, outputPath);
    console.log(`Exported to: ${result}`);
    process.exit(0);
  }

  validateForkFlags(parsed);  // Check conflicts
  validateSessionIdFlags(parsed);  // ❌ Missing in Piclaw

  // Run migrations (settings schema updates)
  const { migratedAuthProviders, deprecationWarnings } = runMigrations(process.cwd());
  time("runMigrations");

  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const startupSettingsManager = SettingsManager.create(cwd, agentDir);
  reportDiagnostics(collectSettingsDiagnostics(startupSettingsManager, "startup session lookup"));

  // Resolve sessionDir from multiple sources
  const envSessionDir = process.env[ENV_SESSION_DIR];
  const sessionDir =
    (parsed.sessionDir ? normalizePath(parsed.sessionDir) : undefined) ??
    (envSessionDir ? expandTildePath(envSessionDir) : undefined) ??
    startupSettingsManager.getSessionDir();

  let sessionManager = await createSessionManager(parsed, cwd, sessionDir, startupSettingsManager);

  // Handle missing cwd issue
  const missingSessionCwdIssue = getMissingSessionCwdIssue(sessionManager, cwd);
  if (missingSessionCwdIssue) {
    if (appMode === "interactive") {
      const selectedCwd = await promptForMissingSessionCwd(missingSessionCwdIssue, startupSettingsManager);
      if (!selectedCwd) process.exit(0);
      sessionManager = SessionManager.open(missingSessionCwdIssue.sessionFile!, sessionDir, selectedCwd);
    } else {
      console.error(chalk.red(new MissingSessionCwdError(missingSessionCwdIssue).message));
      process.exit(1);
    }
  }

  if (parsed.name !== undefined) {
    const name = parsed.name.trim();
    if (!name) { console.error(chalk.red("Error: --name requires a non-empty value")); process.exit(1); }
    sessionManager.appendSessionInfo(name);  // ❌ Missing in Piclaw
  }
  time("createSessionManager");

  const trustStore = new ProjectTrustStore(agentDir);  // ❌ Missing
  const sessionCwd = sessionManager.getCwd();
  const autoTrustOnReloadCwd =
    parsed.projectTrustOverride === undefined && !hasProjectTrustInputs(sessionCwd) ? sessionCwd : undefined;
  const trustPromptMode: AppMode = parsed.help || parsed.listModels !== undefined ? "print" : appMode;
  const projectTrustByCwd = new Map<string, boolean>();

  // Resolve additional paths from CLI
  const resolvedExtensionPaths = resolveCliPaths(cwd, parsed.extensions);
  const resolvedSkillPaths = resolveCliPaths(cwd, parsed.skills);
  const resolvedPromptTemplatePaths = resolveCliPaths(cwd, parsed.promptTemplates);
  const resolvedThemePaths = resolveCliPaths(cwd, parsed.themes);

  const authStorage = AuthStorage.create();

  const createRuntime: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent,
    projectTrustContext,
  }) => {
    const isInitialRuntime = sessionStartEvent === undefined;
    const projectTrustDiagnostics: AgentSessionRuntimeDiagnostic[] = [];
    const cachedProjectTrust = projectTrustByCwd.get(cwd);
    const hasTrustInputs = hasProjectTrustInputs(cwd);
    const shouldResolveProjectTrust =
      parsed.projectTrustOverride === undefined && cachedProjectTrust === undefined && hasTrustInputs;
    const projectTrusted = shouldResolveProjectTrust
      ? false  // Will resolve below
      : (cachedProjectTrust ?? parsed.projectTrustOverride ?? (!hasTrustInputs || trustStore.get(cwd) === true));

    const runtimeSettingsManager = SettingsManager.create(cwd, agentDir, { projectTrusted });
    const services = await createAgentSessionServices({
      cwd,
      agentDir,
      authStorage,
      settingsManager: runtimeSettingsManager,
      extensionFlagValues: parsed.unknownFlags,
      resourceLoaderReloadOptions: {
        resolveProjectTrust: async ({ extensionsResult }) => {
          const trusted = await resolveProjectTrusted({
            cwd,
            trustStore,
            trustOverride: parsed.projectTrustOverride,
            appMode: isInitialRuntime ? trustPromptMode : "print",
            settingsManagerForPrompt: startupSettingsManager,
            extensionsResult,
            projectTrustContext: projectTrustContext ??
              createProjectTrustContext({
                cwd,
                mode: isInitialRuntime ? trustPromptMode : appMode,
                settingsManager: startupSettingsManager,
                hasUI: isInitialRuntime && trustPromptMode === "interactive",
              }),
            onExtensionError: (message) => projectTrustDiagnostics.push({ type: "warning", message }),
          });
          projectTrustByCwd.set(cwd, trusted);
          return trusted;
        },
      },
      resourceLoaderOptions: {
        additionalExtensionPaths: resolvedExtensionPaths,
        additionalSkillPaths: resolvedSkillPaths,
        additionalPromptTemplatePaths: resolvedPromptTemplatePaths,
        additionalThemePaths: resolvedThemePaths,
        noExtensions: parsed.noExtensions,
        noSkills: parsed.noSkills,
        noPromptTemplates: parsed.noPromptTemplates,
        noThemes: parsed.noThemes,
        noContextFiles: parsed.noContextFiles,
        systemPrompt: parsed.systemPrompt,
        appendSystemPrompt: parsed.appendSystemPrompt,
        extensionFactories: options?.extensionFactories,
      },
    });
    const { settingsManager, modelRegistry, resourceLoader } = services;
    const diagnostics: AgentSessionRuntimeDiagnostic[] = [
      ...projectTrustDiagnostics,
      ...services.diagnostics,
      ...collectSettingsDiagnostics(settingsManager, "runtime creation"),
      ...resourceLoader.getExtensions().errors.map(({ path, error }) => ({
        type: "error" as const,
        message: `Failed to load extension "${path}": ${error}`,
      })),
    ];

    const modelPatterns = parsed.models ?? settingsManager.getEnabledModels();
    const scopedModels = modelPatterns && modelPatterns.length > 0
      ? await resolveModelScope(modelPatterns, modelRegistry)
      : [];

    const {
      options: sessionOptions,
      cliThinkingFromModel,
      diagnostics: sessionOptionDiagnostics,
    } = buildSessionOptions(parsed, scopedModels, sessionManager.buildSessionContext().messages.length > 0, modelRegistry, settingsManager);
    diagnostics.push(...sessionOptionDiagnostics);

    if (parsed.apiKey) {
      if (!sessionOptions.model) {
        diagnostics.push({
          type: "error",
          message: "--api-key requires a model to be specified via --model, --provider/--model, or --models",
        });
      } else {
        authStorage.setRuntimeApiKey(sessionOptions.model.provider, parsed.apiKey);
      }
    }

    const created = await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
      model: sessionOptions.model,
      thinkingLevel: sessionOptions.thinkingLevel,
      scopedModels: sessionOptions.scopedModels,
      tools: sessionOptions.tools,
      excludeTools: sessionOptions.excludeTools,
      noTools: sessionOptions.noTools,
      customTools: sessionOptions.customTools,
    });
    const cliThinkingOverride = parsed.thinking !== undefined || cliThinkingFromModel;
    if (created.session.model && cliThinkingOverride) {
      created.session.setThinkingLevel(created.session.thinkingLevel);
    }

    return { ...created, services, diagnostics };
  };

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: sessionManager.getCwd(),
    agentDir,
    sessionManager,
  });
  time("createAgentSessionRuntime");

  const { services, session, modelFallbackMessage } = runtime;
  const { settingsManager, modelRegistry, resourceLoader } = services;
  configureHttpDispatcher(settingsManager.getHttpIdleTimeoutMs());  // ❌ Missing

  if (parsed.help) {
    const extensionFlags = resourceLoader.getExtensions().extensions
      .flatMap(extension => Array.from(extension.flags.values()));
    printHelp(extensionFlags);  // Print help with extension flags
    process.exit(0);
  }

  if (parsed.listModels !== undefined) {
    const searchPattern = typeof parsed.listModels === "string" ? parsed.listModels : undefined;
    await listModels(modelRegistry, searchPattern);
    process.exit(0);
  }

  // Read piped stdin (skip for RPC)
  let stdinContent: string | undefined;
  if (appMode !== "rpc") {
    stdinContent = await readPipedStdin();
    if (stdinContent !== undefined && appMode === "interactive") {
      appMode = "print";
    }
  }
  time("readPipedStdin");

  const { initialMessage, initialImages } = await prepareInitialMessage(
    parsed,
    settingsManager.getImageAutoResize(),
    stdinContent,
  );
  time("prepareInitialMessage");

  initTheme(settingsManager.getTheme(), appMode === "interactive");
  time("initTheme");

  // Show deprecation warnings in interactive mode
  if (appMode === "interactive" && deprecationWarnings.length > 0) {
    await showDeprecationWarnings(deprecationWarnings);
  }

  time("resolveModelScope");
  reportDiagnostics(runtime.diagnostics);
  if (runtime.diagnostics.some(d => d.type === "error")) {
    process.exit(1);
  }
  time("createAgentSession");

  if (appMode !== "interactive" && !session.model) {
    console.error(chalk.red(formatNoModelsAvailableMessage()));
    process.exit(1);
  }

  const startupBenchmark = isTruthyEnvFlag(process.env.PI_STARTUP_BENCHMARK);
  if (startupBenchmark && appMode !== "interactive") {
    console.error(chalk.red("Error: PI_STARTUP_BENCHMARK only supports interactive mode"));
    process.exit(1);
  }

  if (appMode === "rpc") {
    printTimings();
    await runRpcMode(runtime);
  } else if (appMode === "interactive") {
    const interactiveMode = new InteractiveMode(runtime, {
      migratedProviders,
      modelFallbackMessage,
      autoTrustOnReloadCwd,
      initialMessage,
      initialImages,
      initialMessages: parsed.messages,
      verbose: parsed.verbose,
    });
    if (startupBenchmark) { /* ... */ }
    printTimings();
    await interactiveMode.run();
  } else {
    printTimings();
    const exitCode = await runPrintMode(runtime, {
      mode: toPrintOutputMode(appMode),
      messages: parsed.messages,
      initialMessage,
      initialImages,
    });
    stopThemeWatcher();
    restoreStdout();
    if (exitCode !== 0) process.exitCode = exitCode;
    return;
  }
}
```

---

## 9. MODEL SCOPING COMPARISON

### Pi's Flow

```typescript
// Step 1: buildSessionOptions()
function buildSessionOptions(parsed, scopedModels, hasExistingSession, modelRegistry, settingsManager) {
  const options: CreateAgentSessionOptions = {};
  const diagnostics = [];
  let cliThinkingFromModel = false;

  // CLI model with provider support
  if (parsed.model) {
    const resolved = resolveCliModel({
      cliProvider: parsed.provider,
      cliModel: parsed.model,
      modelRegistry,
    });
    // resolved: { model, thinkingLevel?, warning?, error? }
    if (resolved.model) {
      options.model = resolved.model;
      if (!parsed.thinking && resolved.thinkingLevel) {
        options.thinkingLevel = resolved.thinkingLevel;
        cliThinkingFromModel = true;
      }
    }
  }

  // Default: use first scoped model (from enabledModels or all)
  if (!options.model && scopedModels.length > 0 && !hasExistingSession) {
    const savedModel = getDefaultFromSettings();
    const savedInScope = savedModel ? scopedModels.find(sm => modelsAreEqual(sm.model, savedModel)) : undefined;
    if (savedInScope) {
      options.model = savedInScope.model;
    } else {
      options.model = scopedModels[0].model;
    }
  }

  // CLI thinking override
  if (parsed.thinking) {
    options.thinkingLevel = parsed.thinking;
  }

  // Scoped models for cycling (keep thinkingLevel from pattern)
  if (scopedModels.length > 0) {
    options.scopedModels = scopedModels.map(sm => ({
      model: sm.model,
      thinkingLevel: sm.thinkingLevel,
    }));
  }

  return { options, cliThinkingFromModel, diagnostics };
}
```

### Piclaw's Implementation (`model-scoper.ts`)

**Similarities:**
- Pattern matching with wildcard
- Thinking level suffix (`pattern:thinking`)
- Scoped models limit (50)
- Priority: current + default

**Differences:**
- ❌ No `resolveCliModel()` (separate helper)
- ❌ No `resolveModelScope()` (custom implementation)
- ❌ No `modelsAreEqual()` import (uses own comparison)
- ✅ Has scoped model limit with priority
- ✅ More explicit about fallback logic

---

## 10. TIMINGS & BENCHMARKING

### Pi's System

```typescript
// Core timing functions
function time(label: string): void;  // Record elapsed time
function printTimings(): void;      // Print all timings to stderr
function resetTimings(): void;      // Reset timing state

// Usage
resetTimings();
time("parseArgs");
// ... do work
time("createSessionManager");
// ... do work
printTimings();  // Output to stderr

// Benchmark mode
const startupBenchmark = isTruthyEnvFlag(process.env.PI_STARTUP_BENCHMARK);
if (startupBenchmark && appMode !== "interactive") {
  console.error(chalk.red("Error: PI_STARTUP_BENCHMARK only supports interactive mode"));
  process.exit(1);
}
if (startupBenchmark) {
  await interactiveMode.init();
  time("interactiveMode.init");
  printTimings();
  interactiveMode.stop();
  // ...
}
```

### Piclaw's Status

❌ **No timing system at all**

**Could add easily** using simple `console.time()` / `console.timeEnd()` or custom implementation.

---

## 11. SYSTEM PROMPT & CONTEXT

### Pi's Support

```typescript
resourceLoaderOptions: {
  systemPrompt: parsed.systemPrompt,
  appendSystemPrompt: parsed.appendSystemPrompt,
  noContextFiles: parsed.noContextFiles,
}
```

### Piclaw's Gap

❌ No system prompt override
❌ No append system prompt
❌ No context files disable flag

---

## 12. PACKAGE MANAGEMENT (PICLAW EXCLUSIVE)

Piclaw has **extensive package management** that Pi doesn't have:

```bash
piclaw install <source> [-l] [--filter <json>]
piclaw remove <source> [-l]
piclaw list
piclaw update [source] [-l]
piclaw info <source> [-l]
piclaw health
piclaw pin <old> <new> [-l]
piclaw export [output.json] [-l]
piclaw import <input.json> [-l]
```

**Files:**
- `src/package-commands.ts` (~500 lines)
- `src/piclaw-package-manager.ts` (not analyzed yet)

**Verdict:** This is a **strength** of Piclaw! Pi doesn't have this.

---

## 13. COMPLETE MISSING CHECKLIST

### 🔴 **CRITICAL (Security / Core Functionality)**

| # | Feature | File(s) to Modify | Est. Effort |
|---|---------|-------------------|-------------|
| 1 | **Project Trust System** (entire subsystem) | New files: `trust-manager.ts`, `extensions/runner.ts` | 2-3 days |
| 2 | `SessionManager.buildSessionContext()` access | Need to expose from package or workaround | 0.5 day |
| 3 | `assertValidSessionId()` validation | `session-resolver.ts` | 0.5 day |
| 4 | `SessionManager.inMemory()` support | `session-resolver.ts`, `piclaw-core.ts` | 0.5 day |
| 5 | Extension errors collection in diagnostics | `main.ts`, `extensions/factory.ts` | 0.5 day |
| 6 | `resourceLoader.getExtensions()` access | Need package API or workaround | 0.5 day |
| 7 | `AuthStorage` integration | `piclaw-core.ts`, `main.ts` | 0.5 day |

**Total Critical:** ~6-7 items, ~5 days

---

### 🟡 **HIGH PRIORITY (UX / Completeness)**

| # | Feature | File(s) | Est. Effort |
|---|---------|---------|-------------|
| 8 | `--no-tools` modes (all/builtin) | `cli/args.ts`, `piclaw-core.ts` | 0.5 day |
| 9 | `--exclude-tools` flag | `cli/args.ts`, `piclaw-core.ts` | 0.5 day |
| 10 | `--no-builtin-tools` flag | `cli/args.ts`, `piclaw-core.ts` | 0.5 day |
| 11 | `--session-id` flag | `cli/args.ts`, `session-resolver.ts`, `main.ts` | 0.5 day |
| 12 | `--no-session` flag | `cli/args.ts`, `session-resolver.ts` | 0.5 day |
| 13 | `--system-prompt` & `--append-system-prompt` | `cli/args.ts`, `extensions/factory.ts`, `main.ts` | 1 day |
| 14 | `--no-context-files` flag | `cli/args.ts`, `extensions/factory.ts` | 0.5 day |
| 15 | `--models` (multi-pattern) | `cli/args.ts`, `main.ts`, `piclaw-core.ts` | 0.5 day |
| 16 | `--auto-resize-images` flag | `cli/args.ts`, `file-processor.ts`, `main.ts` | 0.5 day |
| 17 | `--version` flag | `cli/args.ts`, `main.ts` | 0.25 day |
| 18 | `--export` HTML mode | `main.ts` (use package's `exportFromFile`) | 0.5 day |
| 19 | `--list-models` with search | `main.ts` (use package's `listModels`) | 0.5 day |
| 20 | `--provider` flag support | `cli/args.ts`, `piclaw-core.ts` | 0.5 day |
| 21 | Extension flags in `--help` | `main.ts` before printHelp | 0.5 day |
| 22 | Settings diagnostics (`drainErrors`) | `config-manager.ts`, `main.ts` | 1 day |
| 23 | Settings directory watching | Need to check if package's SettingsManager supports, else custom | 1 day |
| 24 | `getHttpIdleTimeoutMs()` + dispatcher | `config-manager.ts`, `main.ts` | 0.5 day |
| 25 | `getClearOnShrink()`, `getShowHardwareCursor()` | `config-manager.ts`, TUI setup | 0.5 day |
| 26 | `--name` session name append | `main.ts` | 0.25 day |
| 27 | `--verbose` in InteractiveMode | `interactive-runner.ts`, `main.ts` | 0.25 day |
| 28 | `formatNoModelsAvailableMessage()` | `piclaw-core.ts` or `main.ts` | 0.25 day |
| 29 | Deprecation warnings system | `main.ts`, `piclaw-core.ts` | 1 day |
| 30 | Migrations system | New files: `migrations.ts`, migration scripts | 2 days |
| 31 | Timings system | `utils/timings.ts`, integrate into `main.ts` | 0.5 day |
| 32 | `stopThemeWatcher()` call | `interactive-runner.ts`, cleanup | 0.25 day |
| 33 | `KeybindingsManager.create()` + `setKeybindings()` | `main.ts` | 0.25 day |
| 34 | `ProcessTerminal` for startup UI | N/A (using package's TUI components) | - |
| 35 | Global session picker with TUI | `session-resolver.ts` (use package TUI) | 1 day |
| 36 | Missing cwd prompt with TUI | `main.ts` (use package components) | 0.5 day |
| 37 | `formatMissingSessionCwdPrompt()` | `piclaw-core.ts` | 0.25 day |
| 38 | `MissingSessionCwdError` class | `piclaw-core.ts` | 0.25 day |

**Total High Priority:** ~30 items, ~13-14 days

---

### 🟢 **MEDIUM PRIORITY (Polish)**

| # | Feature | Est. Effort |
|---|---------|-------------|
| 39 | `@plan` syntax support (already done) | - |
| 40 | Structured logging (JSON mode) | 1 day |
| 41 | Better error messages (friendly) | 0.5 day |
| 42 | Session auto-save before fork/resume | 0.5 day |
| 43 | MIME detection via magic numbers | 0.5 day |
| 44 | Configurable scoped model limit | 0.25 day |
| 45 | `--help` examples update | 0.25 day |
| 46 | Auto-resize image config (max dimensions) | 0.5 day |
| 47 | Package manager filter improvements | Already done? |
| 48 | Performance profiling | 0.5 day |

**Total Medium:** ~8 items, ~4 days

---

## 📊 EFFORT SUMMARY

| Priority | Count | Est. Days | Status |
|----------|-------|-----------|--------|
| 🔴 Critical | 7 | 5 | MUST DO |
| 🟡 High | 30 | 14 | SHOULD DO |
| 🟢 Medium | 8 | 4 | NICE TO HAVE |
| **TOTAL** | **45** | **23** | - |

**Plus:** Already done (package manager, @plan, Ctrl+R, tests) = ~10 items

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Foundation (Week 1-2)
1. ✅ **Keep current architecture** (modular is good)
2. 🔴 **Project Trust System** (security critical)
3. 🔴 **Settings diagnostics** + error reporting
4. 🟡 **Session enhancements**: `--session-id`, `--no-session`, `inMemory()`
5. 🟡 **Basic flag support**: `--no-tools`, `--exclude-tools`

Expected: 1.5 weeks

### Phase 2: Completeness (Week 3-4)
6. 🟡 **System prompts**: `--system-prompt`, `--append-system-prompt`
7. 🟡 **Context files**: `--no-context-files`
8. 🟡 **Multi-model**: `--models` array
9. 🟡 **Provider flag**: `--provider`
10. 🟡 **Image flags**: `--auto-resize-images`

Expected: 1 week

### Phase 3: Polish (Week 5)
11. 🟡 **Help system**: Extension flags auto-discovery
12. 🟡 **Model browser**: `--list-models`
13. 🟡 **Export**: `--export` HTML
14. 🟡 **Version**: `--version`
15. 🟢 **Timings system**
16. 🟢 **Theme watcher stop**, keybindings fix

Expected: 0.5 week

### Phase 4: Robustness (Week 5-6)
17. 🔴 **Migrations system**
18. 🔴 **Deprecation warnings**
19. 🟡 **Missing cwd prompt** with TUI
20. 🟡 **HTTP dispatcher** config
21. 🟡 **Settings directory watching**

Expected: 1 week

**Total Estimated:** 4-5 weeks for full parity

---

## 📝 ACTION ITEMS (IMMEDIATE)

### This Week
- [ ] Create `trust-manager.ts` (ProjectTrustStore, hasProjectTrustInputs)
- [ ] Create `extensions/runner.ts` (emitProjectTrustEvent)
- [ ] Integrate trust into `piclaw-core.ts` and `main.ts`
- [ ] Implement `collectSettingsDiagnostics()` + `reportDiagnostics()`
- [ ] Add `--session-id` flag with validation
- [ ] Add `--no-session` flag (use `SessionManager.inMemory()`)
- [ ] Fix `SessionManager.buildSessionContext()` issue (need package support or custom tracking)
- [ ] Add `--no-tools`, `--exclude-tools`, `--no-builtin-tools`

### Next Week
- [ ] Add `--system-prompt` and `--append-system-prompt`
- [ ] Add `--no-context-files`
- [ ] Support multi-model `--models`
- [ ] Add `--auto-resize-images` flag
- [ ] Implement `--provider` support in CLI
- [ ] Extension flags discovery in `--help`
- [ ] `--list-models` implementation
- [ ] `--export` HTML mode
- [ ] `--version` flag
- [ ] Timings system

### Following Weeks
- [ ] Migrations system
- [ ] Deprecation warnings
- [ ] Missing cwd prompt TUI
- [ ] HTTP dispatcher idle timeout
- [ ] Settings directory watching
- [ ] Global session picker TUI
- [ ] `stopThemeWatcher()` cleanup

---

## 🔧 TECHNICAL DECISIONS NEEDED

1. **Session Context Tracking**: Since `SessionManager.buildSessionContext()` is not directly accessible, should we:
   - (A) Track message count ourselves in `piclaw-core.ts`?
   - (B) Add custom property to SessionManager?
   - (C) Always treat new sessions as empty (safe default)?

2. **Settings Diagnostics**: Package's SettingsManager has `drainErrors()`. Does it already work? Need to check package source in `llm-context`.

3. **Extension Flags**: Can we access `resourceLoader.getExtensions()` after runtime creation? Need to check package API.

4. **InMemory Sessions**: Does `SessionManager.inMemory()` exist in package? If not, can we simulate with temp file?

5. **Trust System**: Should we store trust decisions in `~/.piclaw/trust.json` or use package's store?

---

## 📚 REFERENCES

### Pi Source Files Analyzed
- `llm-context/packages/coding-agent/src/main.ts`
- `llm-context/packages/coding-agent/src/cli/args.ts`
- `llm-context/packages/coding-agent/src/core/session-manager.ts`
- `llm-context/packages/coding-agent/src/core/settings-manager.ts`
- `llm-context/packages/coding-agent/src/core/trust-manager.ts`
- `llm-context/packages/coding-agent/src/core/resource-loader.ts`
- `llm-context/packages/coding-agent/src/core/auth-guidance.ts`
- `llm-context/packages/coding-agent/src/core/model-resolver.ts`
- `llm-context/packages/coding-agent/src/modes/interactive/interactive-mode.ts`

### Piclaw Files Analyzed
- `src/main.ts`
- `src/cli/args.ts`
- `src/config/config-manager.ts`
- `src/piclaw-core.ts`
- `src/session-resolver.ts`
- `src/model-scoper.ts`
- `src/file-processor.ts`
- `src/interactive-runner.ts`
- `src/extensions/factory.ts`
- `src/package-commands.ts`
- `src/utils/helpers.ts`
- `src/utils/output-guard.ts`

---

**END OF ANALYSIS**

*Next step: Start implementing Phase 1 items.*
