# 📚 API EXPORT FROM @mariozechner/pi-coding-agent

**Full reference của tất cả exports từ package `@mariozechner/pi-coding-agent`**

File: `llm-context/packages/coding-agent/src/index.ts`

Tổng: **~308 exports** (types, classes, functions, constants)

---

## 📦 MODULE BREAKDOWN

### 1. Config (`./config.js`)
- `getAgentDir(): string` – Get agent directory path (`~/.pi/agent`)
- `VERSION: string` – Package version

**Purpose**: Path resolution and version info.

---

### 2. AgentSession (`./core/agent-session.js`)

**Types** (8):
- `AgentSession` – Main session class instance
- `AgentSessionConfig` – Configuration for agent session
- `AgentSessionEvent` – Union of all session events
- `AgentSessionEventListener` – Event handler type
- `ModelCycleResult` – Result from cycling models
- `ParsedSkillBlock` – Parsed skill invocation block
- `PromptOptions` – Options for prompting
- `SessionStats` – Statistics about session

**Functions** (1):
- `parseSkillBlock(text: string): ParsedSkillBlock | null` – Parse skill block from user message

**Purpose**: Core agent session management, message handling, statistics.

---

### 3. Auth Storage (`./core/auth-storage.js`)

**Types** (7):
- `ApiKeyCredential` – API key credential shape
- `AuthCredential` – Union of credential types
- `AuthStatus` – Provider auth status
- `AuthStorageBackend` – Backend interface
- `OAuthCredential` – OAuth credential shape
- `FileAuthStorageBackend` – File-based backend
- `InMemoryAuthStorageBackend` – In-memory backend

**Classes** (2):
- `AuthStorage` – Main storage class for credentials
- `FileAuthStorageBackend` – File backend implementation
- `InMemoryAuthStorageBackend` – Memory backend implementation

**Purpose**: Manage API keys and OAuth credentials.

---

### 4. Compaction (`./core/compaction/index.js`)

**Types** (16):
- `BranchPreparation` – Data for branch summarization
- `BranchSummaryResult` – Result of branch summary
- `CollectEntriesResult` – Result from collecting entries
- `CompactionResult` – Result of compaction
- `CutPointResult` – Result from finding cut point
- `FileOperations` – File operations for compaction
- `GenerateBranchSummaryOptions` – Options for summary generation
- `...` (and more)

**Functions** (12):
- `calculateContextTokens(messages): number` – Calculate token count
- `collectEntriesForBranchSummary(options): BranchPreparation` – Collect entries to summarize
- `compact(sessionManager, options?): Promise<CompactionResult>` – Compact session
- `estimateTokens(text): number` – Rough token estimation
- `findCutPoint(entries, options?): CutPointResult` – Find where to cut
- `findTurnStartIndex(entries, fromIndex): number` – Find turn start
- `generateBranchSummary(options): Promise<BranchSummaryResult>` – Generate summary
- `generateSummary(messages, customInstructions?): Promise<string>` – Generate summary text
- `getLastAssistantUsage(messages)` – Get last assistant token usage
- `prepareBranchEntries(options): Promise<CollectEntriesResult>` – Prepare entries for summarization
- `serializeConversation(messages): string` – Serialize to text
- `shouldCompact(contextUsage, settings): boolean` – Determine if compaction needed

**Constants** (1):
- `DEFAULT_COMPACTION_SETTINGS: CompactionSettings` – Default compaction config

**Purpose**: Context window management, summarization, compaction.

---

### 5. Event Bus (`./core/event-bus.js`)

**Types** (2):
- `EventBus` – Event bus interface
- `EventBusController` – Controller for event bus

**Functions** (1):
- `createEventBus(): EventBus` – Create new event bus

**Purpose**: Decoupled event system for extensions.

---

### 6. Extensions (`./core/extensions/index.js`) – **LARGEST MODULE**

#### Types (72 types)

**Core Extension Types**:
- `Extension` – Extension definition object
- `ExtensionAPI` – API passed to extensions
- `ExtensionFactory` – Factory function type
- `ExtensionRunner` – Runtime for extensions
- `ExtensionError` – Error shape

**Event Types** (25+ events):
- `AgentStartEvent`, `AgentEndEvent`
- `TurnStartEvent`, `TurnEndEvent`
- `MessageStartEvent`, `MessageUpdateEvent`, `MessageEndEvent`
- `ToolExecutionStartEvent`, `ToolExecutionUpdateEvent`, `ToolExecutionEndEvent`
- `ToolCallEvent` (various specific: `BashToolCallEvent`, `ReadToolCallEvent`, etc.)
- `ToolResultEvent` (various specific)
- `SessionStartEvent`, `SessionBeforeSwitchEvent`, `SessionBeforeForkEvent`, `SessionBeforeCompactEvent`, `SessionCompactEvent`, `SessionShutdownEvent`, `SessionBeforeTreeEvent`, `SessionTreeEvent`
- `ContextEvent`, `BeforeProviderRequestEvent`, `AfterProviderResponseEvent`
- `InputEvent`, `InputEventResult`
- `UserBashEvent`, `UserBashEventResult`
- `ModelSelectEvent`
- `BeforeAgentStartEvent`, `BeforeAgentStartEventResult`

**Context Types**:
- `ExtensionContext` – Base context for event handlers
- `ExtensionCommandContext` – Context for command handlers (has more methods)
- `ExtensionCommandContextActions` – Actions available in command context
- `ExtensionContextActions` – Actions available in base context
- `ExtensionUIContext` – UI methods for interactive dialogs
- `ExtensionUIDialogOptions` – Options for UI dialogs
- `ExtensionWidgetOptions` – Options for widgets
- `ToolRenderContext` – Context for tool renderers

**Tool Types**:
- `ToolDefinition<TParams, TDetails, TState>` – Full tool definition
- `ToolInfo` – Read-only tool info (name, description, parameters)
- `ToolRenderResultOptions` – Options for result rendering
- `ToolExecutionMode` – "sequential" | "parallel"

**Registration Types**:
- `RegisteredCommand` – Command registration info
- `RegisteredTool` – Registered tool with source
- `ResolvedCommand` – Command after resolution
- `ExtensionFlag` – CLI flag definition
- `ExtensionShortcut` – Keyboard shortcut definition

**Other Types**:
- `AutocompleteProviderFactory` – Factory to wrap autocomplete
- `BuildSystemPromptOptions` – Options for system prompt building
- `CompactOptions` – Compaction options
- `ContextUsage` – Context window usage
- `KeybindingsManager` – Keybindings manager
- `LoadExtensionsResult` – Result of loading extensions
- `MessageRenderer<T>` – Custom message renderer
- `MessageRenderOptions` – Options for message rendering
- `ProviderConfig` – Provider registration config
- `ProviderModelConfig` – Model config in provider
- `SlashCommandInfo` – Slash command metadata
- `SlashCommandSource` – Source of slash command
- `SourceInfo` – Source metadata (scope, source, path)
- `TerminalInputHandler` – Raw terminal input handler
- `WidgetPlacement` – "aboveEditor" | "belowEditor"
- `WorkingIndicatorOptions` – Spinner configuration

#### Functions/Classes (14):

**Extension Runtime**:
- `createExtensionRuntime(): ExtensionRuntime` – Create extension runtime
- `discoverAndLoadExtensions(options): Promise<LoadExtensionsResult>` – Discover and load extensions from paths
- `ExtensionRunner` – Class that runs extensions

**Tool Utilities**:
- `defineTool(tool): ToolDefinition` – Preserve type inference for tool definitions
- `wrapRegisteredTool(tool, sourceInfo): RegisteredTool` – Wrap tool with source metadata
- `wrapRegisteredTools(tools, sourceInfo): RegisteredTool[]` – Wrap array of tools

**Type Guards**:
- `isBashToolResult(event): event is BashToolCallEvent`
- `isEditToolResult(event): event is EditToolCallEvent`
- `isFindToolResult(event): event is FindToolToolCallEvent`
- `isGrepToolResult(event): event is GrepToolToolCallEvent`
- `isLsToolResult(event): event is LsToolCallEvent`
- `isReadToolResult(event): event is ReadToolCallEvent`
- `isWriteToolResult(event): event is WriteToolCallEvent`
- `isToolCallEventType(toolName, event): boolean` – Type guard for tool call events

**Purpose**: Full extension system – register tools, commands, events, UI integration.

---

### 7. Footer Data Provider (`./core/footer-data-provider.js`)

**Types** (1):
- `ReadonlyFooterDataProvider` – Read-only footer data (git branch, extension statuses)

**Purpose**: Provide data for footer display (git branch, extension statuses).

---

### 8. Messages (`./core/messages.js`)

**Functions** (1):
- `convertToLlm(messages: AgentMessage[]): Message[]` – Convert internal messages to LLM format

**Purpose**: Message conversion for LLM API.

---

### 9. Model Registry (`./core/model-registry.js`)

**Classes** (1):
- `ModelRegistry` – Registry for models and providers, handles API key resolution

**Purpose**: Manage available models, providers, and credentials.

---

### 10. Package Manager (`./core/package-manager.js`)

**Types** (6):
- `PackageManager` – Interface for package managers
- `PathMetadata` – Metadata about a file path
- `ProgressCallback` – Progress callback type
- `ProgressEvent` – Progress event shape
- `ResolvedPaths` – Resolved path results
- `ResolvedResource` – Resolved resource with source info

**Classes** (1):
- `DefaultPackageManager` – Default implementation using npm/pnpm/yarn

**Purpose**: Package manager integration for checking updates, installing tools.

---

### 11. Resource Loader (`./core/resource-loader.js`)

**Types** (3):
- `ResourceCollision` – Collision info when same name from multiple sources
- `ResourceDiagnostic` – Diagnostic (warning/error) for resources
- `ResourceLoader` – Interface for loading resources

**Functions/Classes** (2):
- `DefaultResourceLoader` – Class that loads extensions, skills, prompts, themes
- `loadProjectContextFiles(cwd, agentDir, settingsManager): Promise<AgentsFiles>` – Load .pi/agent/*.json files

**Purpose**: Load extensions, skills, prompts, themes from various sources (local, npm, git).

---

### 12. SDK (`./core/sdk.js`) – **PROGRAMMATIC USAGE**

**Types** (9):
- `AgentSessionRuntimeDiagnostic` – Non-fatal issues during runtime creation
- `AgentSessionServices` – Cwd-bound services (auth, models, settings, resource loader)
- `CreateAgentSessionFromServicesOptions` – Options when creating from services
- `CreateAgentSessionOptions` – Options for `createAgentSession`
- `CreateAgentSessionResult` – Result from session creation
- `CreateAgentSessionRuntimeFactory` – Factory type for runtime creation
- `CreateAgentSessionRuntimeResult` – Result from runtime creation
- `CreateAgentSessionServicesOptions` – Options for service creation
- `PromptTemplate` – Prompt template shape

**Classes/Functions** (14):
- `AgentSessionRuntime` – Class owning session + services, handles session switching
- `createAgentSession(options): Promise<CreateAgentSessionResult>` – Main entry point
- `createAgentSessionFromServices(options): Promise<CreateAgentSessionResult>` – Create from existing services
- `createAgentSessionRuntime(options): Promise<CreateAgentSessionRuntimeResult>` – Create full runtime (session + services)
- `createAgentSessionServices(options): Promise<AgentSessionServices>` – Create cwd-bound services only
- `createBashTool(cwd, options?): ToolDefinition` – Factory for bash tool with custom cwd
- `createCodingTools(cwd): ToolDefinition[]` – Factory for read, edit, write tools
- `createEditTool(cwd, options?): ToolDefinition`
- `createFindTool(cwd, options?): ToolDefinition`
- `createGrepTool(cwd, options?): ToolDefinition`
- `createLsTool(cwd, options?): ToolDefinition`
- `createReadOnlyTools(cwd): ToolDefinition[]` – read, find, grep, ls
- `createReadTool(cwd, options?): ToolDefinition`
- `createWriteTool(cwd, options?): ToolDefinition`

**Purpose**: Programmatic API for creating agent sessions without TUI.

---

### 13. Session Manager (`./core/session-manager.js`)

**Types** (15):
- `BranchSummaryEntry` – Entry for branch summary
- `CompactionEntry` – Compaction record
- `CustomEntry` – Custom entry in session
- `CustomMessageEntry` – Custom message entry
- `FileEntry` – Entry representing file context
- `ModelChangeEntry` – Model change record
- `NewSessionOptions` – Options for new session
- `SessionContext` – Aligned messages + entries
- `SessionEntry` – Union of all entry types
- `SessionEntryBase` – Base entry interface
- `SessionHeader` – Session header metadata
- `SessionInfo` – Session file metadata
- `SessionInfoEntry` – Entry in session info
- `SessionMessageEntry` – Message entry
- `ThinkingLevelChangeEntry` – Thinking level change record

**Values** (6):
- `buildSessionContext(): SessionContext` – Build context from entries
- `CURRENT_SESSION_VERSION: number` – Current session format version
- `getLatestCompactionEntry(entries): CompactionEntry | undefined` – Get latest compaction
- `migrateSessionEntries(entries): SessionEntry[]` – Migrate old entries
- `parseSessionEntries(lines): SessionEntry[]` – Parse JSONL entries
- `SessionManager` – Class managing session files

**Purpose**: Session persistence, tree navigation, compaction tracking.

---

### 14. Settings Manager (`./core/settings-manager.js`)

**Types** (4):
- `CompactionSettings` – Compaction configuration
- `ImageSettings` – Image display settings
- `PackageSource` – "npm" | "git" | "local" | "cli"
- `RetrySettings` – Retry configuration

**Class** (1):
- `SettingsManager` – Manages user settings (persisted in ~/.pi/agent/settings.json)

**Purpose**: Settings persistence and access.

---

### 15. Skills (`./core/skills.js`)

**Types** (4):
- `LoadSkillsFromDirOptions` – Options for loading from directory
- `LoadSkillsResult` – Result of skill loading
- `Skill` – Skill definition
- `SkillFrontmatter` – Frontmatter metadata

**Functions** (3):
- `formatSkillsForPrompt(skills, options): string` – Format skills for system prompt
- `loadSkills(resourceLoader, options): Promise<LoadSkillsResult>` – Load skills from resources
- `loadSkillsFromDir(dir, options): Promise<LoadSkillsResult>` – Load skills from directory

**Purpose**: Load and manage skill definitions (reusable prompt templates with arguments).

---

### 16. Source Info (`./core/source-info.js`)

**Functions** (1):
- `createSyntheticSourceInfo(source, baseDir?): SourceInfo` – Create synthetic source info

**Purpose**: Create source metadata for resources.

---

### 17. Tools (`./core/tools/index.js`) – **TOOL DEFINITIONS**

**Types** (30+):
- `BashOperations` – bash tool operations interface
- `BashSpawnContext` – Context for bash spawn
- `BashSpawnHook` – Hook for bash spawn
- `BashToolDetails` – Result details from bash
- `BashToolInput` – Input schema for bash
- `BashToolOptions` – Options for bash tool
- `EditOperations` – edit tool operations
- `EditToolDetails` – Result details from edit
- `EditToolInput` – Input schema for edit
- `EditToolOptions` – Options for edit
- `FindOperations` – find tool operations
- `FindToolDetails` – Result details from find
- `FindToolInput` – Input schema for find
- `FindToolOptions` – Options for find
- `GrepOperations` – grep tool operations
- `GrepToolDetails` – Result details from grep
- `GrepToolInput` – Input schema for grep
- `GrepToolOptions` – Options for grep
- `LsOperations` – ls tool operations
- `LsToolDetails` – Result details from ls
- `LsToolInput` – Input schema for ls
- `LsToolOptions` – Options for ls
- `ReadOperations` – read tool operations
- `ReadToolDetails` – Result details from read
- `ReadToolInput` – Input schema for read
- `ReadToolOptions` – Options for read
- `ToolsOptions` – Common tool options
- `TruncationOptions` – Options for truncation
- `TruncationResult` – Result of truncation
- `WriteOperations` – write tool operations
- `WriteToolInput` – Input schema for write
- `WriteToolOptions` – Options for write

**Functions/Constants** (15):
- `createBashToolDefinition(cwd, options?): ToolDefinition` – Create bash tool
- `createEditToolDefinition(cwd, options?): ToolDefinition`
- `createFindToolDefinition(cwd, options?): ToolDefinition`
- `createGrepToolDefinition(cwd, options?): ToolDefinition`
- `createLocalBashOperations(cwd): BashOperations` – Create bash ops for local execution
- `createLsToolDefinition(cwd, options?): ToolDefinition`
- `createReadToolDefinition(cwd, options?): ToolDefinition`
- `createWriteToolDefinition(cwd, options?): ToolDefinition`
- `DEFAULT_MAX_BYTES: number` – Default max bytes for read
- `DEFAULT_MAX_LINES: number` – Default max lines for read
- `formatSize(bytes): string` – Human-readable size
- `truncateHead(text, options): TruncationResult` – Truncate from head
- `truncateLine(line, maxCells): TruncationResult` – Truncate single line to visual width
- `truncateTail(text, options): TruncationResult` – Truncate from tail
- `withFileMutationQueue<T>(fn): (args) => Promise<T>` – Wrap tool with file mutation queue

**Purpose**: Built-in tool definitions (bash, read, write, edit, find, grep, ls) with truncation and safety.

---

### 18. Main (`./main.js`)

**Types** (1):
- `MainOptions` – Options for main entry point

**Functions** (1):
- `main(args?: string[]): Promise<void>` – Main entry point (CLI)

**Purpose**: CLI entry point.

---

### 19. Modes (`./modes/index.js`) – **RUN MODES**

**Types** (8):
- `InteractiveModeOptions` – Options for interactive mode
- `ModelInfo` – Model info for scoped models
- `PrintModeOptions` – Options for print mode
- `RpcClientOptions` – Options for RPC client
- `RpcCommand` – RPC command shape
- `RpcEventListener` – Event handler for RPC
- `RpcResponse` – RPC response shape
- `RpcSessionState` – Session state for RPC

**Classes/Functions** (4):
- `InteractiveMode` – Class for interactive TUI mode
- `RpcClient` – RPC client for remote control
- `runPrintMode(options): Promise<void>` – Run in print mode (non-interactive)
- `runRpcMode(options): Promise<void>` – Run in RPC mode

**Purpose**: Different execution modes (interactive TUI, print, RPC).

---

### 20. UI Components (`./modes/interactive/components/index.js`)

**Components** (30):
- `ArminComponent` – Easter egg component
- `AssistantMessageComponent` – Renders assistant messages
- `BashExecutionComponent` – Renders bash execution
- `BorderedLoader` – Loader with border
- `BranchSummaryMessageComponent` – Renders branch summary
- `CompactionSummaryMessageComponent` – Renders compaction summary
- `CustomEditor` – Base class for custom editors
- `CustomMessageComponent` – Renders custom messages
- `DynamicBorder` – Border that adapts to content
- `ExtensionEditorComponent` – Multi-line editor for extensions
- `ExtensionInputComponent` – Text input for extensions
- `ExtensionSelectorComponent` – Selector for extensions
- `FooterComponent` – Footer UI
- `keyHint` – Helper to render key hint
- `keyText` – Helper to get key string
- `LoginDialogComponent` – OAuth/login dialog
- `ModelSelectorComponent` – Model selection UI
- `OAuthSelectorComponent` – Provider selection for auth
- `rawKeyHint` – Raw key hint without styling
- `renderDiff` – Render text diff
- `SessionSelectorComponent` – Session selection UI
- `SettingsSelectorComponent` – Settings UI
- `ShowImagesSelectorComponent` – Image toggle UI
- `SkillInvocationMessageComponent` – Skill block renderer
- `ThemeSelectorComponent` – Theme selection UI
- `ThinkingSelectorComponent` – Thinking level selector
- `ToolExecutionComponent` – Tool call/result renderer
- `TreeSelectorComponent` – Session tree navigation UI
- `truncateToVisualLines` – Truncate to visual lines
- `UserMessageComponent` – User message renderer
- `UserMessageSelectorComponent` – User message selector for forking

**Types** (5):
- `RenderDiffOptions` – Options for diff rendering
- `SettingsCallbacks` – Callbacks for settings UI
- `SettingsConfig` – Config for settings UI
- `ToolExecutionOptions` – Options for tool component
- `VisualTruncateResult` – Result of visual truncation

**Purpose**: All UI components for interactive mode.

---

### 21. Theme (`./modes/interactive/theme/theme.js`)

**Functions/Values** (7):
- `getLanguageFromPath(path): string` – Detect language from file extension
- `getMarkdownTheme(): MarkdownTheme` – Get markdown theme
- `getSelectListTheme(): Theme` – Get theme for select lists
- `getSettingsListTheme(): Theme` – Get theme for settings list
- `highlightCode(code, language): string` – Syntax highlight code
- `initTheme(name, save?): void` – Initialize theme by name
- `Theme` – Theme class (instance accessible as `theme`)

**Type** (1):
- `ThemeColor` – Color names in theme

**Purpose**: Theme management and syntax highlighting.

---

### 22. Utils - Clipboard (`./utils/clipboard.js`)

**Functions** (1):
- `copyToClipboard(text): Promise<void>` – Copy text to clipboard

**Purpose**: Clipboard operations.

---

### 23. Utils - Frontmatter (`./utils/frontmatter.js`)

**Functions** (2):
- `parseFrontmatter(content): { frontmatter, body }` – Parse YAML frontmatter
- `stripFrontmatter(content): string` – Remove frontmatter from content

**Purpose**: Frontmatter parsing for skills/skills.

---

### 24. Utils - Shell (`./utils/shell.js`)

**Functions** (1):
- `getShellConfig(): { name, args }` – Detect shell and its config file

**Purpose**: Shell configuration detection.

---

## 🎯 **QUICK REFERENCE BY USE CASE**

### **Creating Agent Programmatically**
```
createAgentSession(options)
createAgentSessionServices(options)
createAgentSessionRuntime(options)
AgentSessionRuntime
```

### **Building Extensions**
```
ExtensionAPI
ToolDefinition
ExtensionContext
ExtensionCommandContext
ExtensionUIContext
```

### **Session Management**
```
SessionManager
SessionContext
buildSessionContext()
```

### **Settings**
```
SettingsManager
CompactionSettings
ImageSettings
RetrySettings
```

### **Models & Auth**
```
ModelRegistry
AuthStorage
```

### **Tools**
```
createBashToolDefinition(cwd)
createReadToolDefinition(cwd)
createWriteToolDefinition(cwd)
createEditToolDefinition(cwd)
createFindToolDefinition(cwd)
createGrepToolDefinition(cwd)
createLsToolDefinition(cwd)
```

### **Events**
```
All event types from extensions (AgentStartEvent, ToolExecutionStartEvent, etc.)
ExtensionRunner (emit, emitBeforeProviderRequest, etc.)
```

### **UI Components (for custom editors/selectors)**
```
All components in ./modes/interactive/components/
Theme utilities
```

### **Resource Loading**
```
DefaultResourceLoader
ResourceLoader
ResourceDiagnostic
```

### **Compaction**
```
compact()
shouldCompact()
generateSummary()
```

---

## 📝 **IMPORT PATTERNS**

```typescript
// Programmatic usage (SDK)
import {
  createAgentSession,
  AgentSessionRuntime,
  SettingsManager,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

// Extension development
import type {
  ExtensionAPI,
  ToolDefinition,
  ExtensionContext,
  AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";

// UI components (rare)
import {
  ToolExecutionComponent,
  SettingsSelectorComponent,
  Theme,
} from "@mariozechner/pi-coding-agent";

// Tools
import {
  createBashToolDefinition,
  createReadToolDefinition,
  truncateHead,
} from "@mariozechner/pi-coding-agent";
```

---

## 🔍 **TOTAL EXPORT COUNT**

| Category | Count |
|----------|-------|
| Types | ~200+ |
| Classes | ~20 |
| Functions | ~80 |
| Constants | ~10 |
| **TOTAL** | **~308** |

---

**Note**: This reference lists all public exports. For detailed type signatures and documentation, read the source files in `llm-context/packages/coding-agent/src/`.
