# PHÂN TÍCH TOÀN DIỆN: 43+ CÁCH CAN THIỆP VÀO HỆ THỐNG PICLAW

**Phân tích từ:** `llm-context/packages/agent/`, `llm-context/packages/coding-agent/`, `llm-context/packages/tui/`

---

## 📊 TỔNG KẾT

| Category | Count | Mức Độ |
|----------|-------|--------|
| Agent Core Hooks | 8 | Cao |
| Agent Events | 11 | Cao |
| Extension Events | 25+ | Cao |
| Tool Hooks | 14 | Cao |
| UI Customization | 12 | Trung |
| Context Actions | 10 | Trung |
| Resource Loading | 10 | Trung |
| Configuration | 20+ | Thấp |
| **TOTAL** | **43+** | - |

---

## 🎯 PHÂN LOẠI THEO MỨC ĐỘ

### 🔴 **CAO** - Can thiệp sâu, toàn diện
1. Agent Core Options (8 hooks)
2. Extension Event Listeners (25+ events)
3. Tool Call/Result Hooks (14 types)
4. Custom Tool Rendering (call & result)
5. Provider Registration
6. Custom Message Types (declaration merging)
7. Session Manager Override
8. Model Registry Hook
9. Auth Storage Backend
10. Event Bus Direct Access
11. Compaction Strategy Customization
12. Stream Function Override
13. Context Transformation
14. Steering/Follow-up Messages

### 🟡 **TRUNG** - Can thiệp trung bình
15. Slash Commands
16. UI Widgets (above/below editor)
17. Custom Footer/Header
18. Autocomplete Provider
19. Custom Editor Component
20. Notification System
21. Dialog Primitives (select/confirm/input)
22. Keybinding Override
23. Theme System
24. Working Indicator
25. Tool Output Expansion
26. Image Display Toggle
27. Session Tree Customization
28. Status Bar Items

### 🟢 **THẤP** - Cấu hình, ít code
29. Config File (`config.json`)
30. Settings File (`settings.json`)
31. Auth File (`auth.json`)
32. Context Files (AGENTS.md, SYSTEM.md)
33. Skills (markdown)
34. Prompt Templates (markdown)
35. Themes (JSON)
36. Extension Paths
37. Skill Paths
38. Prompt Paths
39. Theme Paths
40. CLI Flags
41. Environment Variables
42. Model List (`models.json`)
43. Package Manager Integration

---

## 🔴 **1-14: AGENT CORE HỌCKS & EVENTS** (Cao)

### **1. AgentOptions - Constructor Injection**

**Location:** `@mariozechner/pi-agent-core` - `new Agent(options)`

**8 Hook Points:**

```typescript
interface AgentOptions {
  // 1. convertToLlm - Transform AgentMessage[] → LLM Message[]
  convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;

  // 2. streamFn - Override entire LLM streaming
  streamFn?: StreamFn;

  // 3. transformContext - Pre-process context before LLM
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;

  // 4. getApiKey - Dynamic API key resolution (OAuth refresh)
  getApiKey?: (provider: string) => Promise<string | undefined>;

  // 5. beforeToolCall - Block/sanitize tool execution
  beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult>;

  // 6. afterToolCall - Override tool result
  afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult>;

  // 7. shouldStopAfterTurn - Early termination
  shouldStopAfterTurn?: (context: ShouldStopAfterTurnContext) => boolean;

  // 8. Steering/Follow-up queuing
  getSteeringMessages?: () => Promise<AgentMessage[]>;
  getFollowUpMessages?: () => Promise<AgentMessage[]>;

  // ... other options
}
```

**Usage:** Tạo Agent instance với custom hooks.

---

### **2. AgentEvent - 11 Event Types**

**Location:** `@mariozechner/pi-agent-core` - `AgentEvent` union

```typescript
type AgentEvent =
  // Agent lifecycle
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }

  // Turn lifecycle
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }

  // Message lifecycle (user, assistant, toolResult)
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
  | { type: "message_end"; message: AgentMessage }

  // Tool execution (generic)
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };
```

**Subscription:** `agent.subscribe((event) => {...})`

---

### **3. ExtensionEvent - 25+ Event Types**

**Location:** `packages/coding-agent/src/core/extensions/types.ts`

#### **Session Events (7)**
```typescript
{ type: "session_start" }
{ type: "session_tree"; tree: SessionTree; currentLeafId: string }
{ type: "session_before_switch"; targetPath: string; currentSession: string } → can cancel
{ type: "session_before_fork"; entryId: string; position?: "before" | "at" } → can cancel
{ type: "session_before_compact" } → can cancel, custom instructions
{ type: "session_compact" } // after compaction done
{ type: "session_shutdown" }
```

#### **Agent Events (4)**
```typescript
{ type: "before_agent_start"; initialState: Partial<AgentState> } → can modify
{ type: "agent_start" }
{ type: "agent_end"; messages: AgentMessage[] }
```

#### **Turn Events (2)**
```typescript
{ type: "turn_start" }
{ type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
```

#### **Message Events (3)**
```typescript
{ type: "message_start"; message: AgentMessage }
{ type: "message_update"; message: AgentMessage } // streaming chunks
{ type: "message_end"; message: AgentMessage }
```

#### **Tool Call/Result Events (10)**
##### Specific types for each built-in tool:
```typescript
// Tool call (before execution)
type ToolCallEvent =
  | { type: "tool_call"; toolName: string; toolCallId: string; args: any }
  | { type: "tool_call"; toolName: "bash"; ... } extends BashToolCallEvent
  | { type: "tool_call"; toolName: "read"; ... } extends ReadToolCallEvent
  | { type: "tool_call"; toolName: "edit"; ... } extends EditToolCallEvent
  | { type: "tool_call"; toolName: "write"; ... } extends WriteToolCallEvent
  | { type: "tool_call"; toolName: "grep"; ... } extends GrepToolCallEvent
  | { type: "tool_call"; toolName: "find"; ... } extends FindToolCallEvent
  | { type: "tool_call"; toolName: "ls"; ... } extends LsToolCallEvent
  | { type: "tool_call"; toolName: "custom"; ... } extends CustomToolCallEvent

// Tool result (after execution)
type ToolResultEvent =
  | { type: "tool_result"; toolName: string; toolCallId: string; result: any; isError: boolean }
  | { type: "tool_result"; toolName: "bash"; ... } extends BashToolResultEvent
  // ... similar for other tools
```

**Can modify?** Yes, return value overrides.

#### **Tool Execution Events (3)**
```typescript
{ type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
{ type: "tool_execution_update"; toolCallId: string; toolName: string; partialResult: any }
{ type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean }
```

#### **Model Events (1)**
```typescript
{ type: "model_select"; model: Model<any>; source: "set" | "cycle" | "restore" }
```

#### **Context Events (2)**
```typescript
{ type: "context"; messages: AgentMessage[] } → can modify messages
{ type: "before_provider_request"; payload: ProviderRequest } → can modify payload
{ type: "after_provider_response"; response: ProviderResponse }
```

#### **User Events (2)**
```typescript
{ type: "input"; source: "interactive" | "rpc" | "extension"; text: string } → can consume
{ type: "user_bash"; command: string } → can override execution
```

#### **Resource Events (1)**
```typescript
{ type: "resources_discover"; cwd: string; reason: "startup" | "reload" }
→ return { skillPaths?, promptPaths?, themePaths? }
```

**Total Events:** 25+ specific types.

**Subscription:** `api.on("event_type", handler)`

---

### **4. Tool Call/Result Hooks (14)**

**From AgentOptions:**
1. `beforeToolCall` - Block/modify before execution
2. `afterToolCall` - Override result after execution

**From Extension Events:**
3. `tool_call` (7 specific + 1 custom) - before execution, can block
4. `tool_result` (7 specific + 1 custom) - after execution, can override
5. `tool_execution_start` - monitor start
6. `tool_execution_update` - monitor progress
7. `tool_execution_end` - monitor completion

**Total Hook Points:** 14+.

---

### **5. Custom Tool Registration**

**API:** `api.registerTool(toolDefinition)`

```typescript
interface ToolDefinition<TParams, TDetails, TState> {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string; // For system prompt
  promptGuidelines?: string[]; // For system prompt
  parameters: TSchema; // TypeBox schema
  renderShell?: "default" | "self";
  prepareArguments?: (args: unknown) => Static<TParams>;
  executionMode?: "sequential" | "parallel";
  execute: (id, params, signal, onUpdate, ctx) => Promise<AgentToolResult<TDetails>>;

  // Custom rendering (optional)
  renderCall?: (args, theme, context) => Component;
  renderResult?: (result, options, theme, context) => Component;
}
```

**LLM sees:** Name, description, parameters → auto-calls.

**Result:** Shown in UI, can be custom rendered.

---

### **6. Custom Message Types**

**Mechanism:** Declaration Merging

```typescript
// In your extension or app code:
declare module "@mariozechner/pi-agent-core" {
  interface CustomAgentMessages {
    branchSummary: BranchSummaryMessage;
    compactionSummary: CompactionSummaryMessage;
    myCustomType: MyCustomMessage;
  }
}

// Usage:
session.addMessage({
  customType: "myCustomType",
  content: "data",
  timestamp: Date.now(),
});
```

**Available throughout:** Type-safe custom messages.

---

### **7. Session Manager Override**

**Hook Points:**
- `session_before_switch` → can cancel switch
- `session_before_fork` → can cancel fork, modify entry
- `session_before_compact` → can cancel, add instructions
- `session_compact` → after compaction

**Access:** `ctx.sessionManager` (ReadonlySessionManager)

**Methods:** `getSessionInfo()`, `getEntries()`, `navigateTo()`, `fork()`, `switch()`, `compact()`

---

### **8. Model Registry Hook**

**Access:** `ctx.modelRegistry`

**Methods:**
- `getModels()` - List all models
- `getApiKeyAndHeaders(model)` - Resolve API key + headers
- `getModel(modelId)` - Get model metadata
- `providers` - All registered providers

**Dynamic API Key:** Use `getApiKey` in AgentOptions to refresh OAuth tokens.

---

### **9. Auth Storage Backend**

**Default:** File-based (`~/.piclaw/auth.json`)

**Custom:** Implement `AuthStorageBackend`

```typescript
interface AuthStorageBackend {
  getCredentials(provider: string): Promise<AuthCredential | null>;
  setCredentials(provider: string, credential: AuthCredential): Promise<void>;
  removeCredentials(provider: string): Promise<void>;
  listProviders(): Promise<string[]>;
}
```

**Usage:** Pass to `AuthStorage` constructor, or override via config.

---

### **10. Event Bus Direct Access**

**Access:** `ctx.eventBus` (if enabled)

**Methods:**
- `emit(event)` - emit custom events
- `on(event, handler)` - subscribe
- `off(event, handler)` - unsubscribe

**Use:** Inter-extension communication.

---

### **11. Compaction Customization**

**Hook:** `session_before_compact` → add `customInstructions`

**Override:** `AgentOptions.transformContext` → manual compaction logic

**Direct:** `compact()` method với options

```typescript
ctx.compact({
  customInstructions: "Keep all import statements, remove comments",
  onComplete: (result) => console.log(result),
});
```

---

### **12. Stream Function Override**

**AgentOption:** `streamFn`

Replace entire LLM streaming implementation:

```typescript
streamFn: async (model, context, options) => {
  // Custom streaming logic
  // Must return AssistantMessageEventStream
  return streamSimple(model, context, { ... });
}
```

**Use cases:**
- Custom API format
- Mock streaming (testing)
- Add middleware (logging, metrics)
- Multi-provider fallback

---

### **13. Context Transformation**

**AgentOption:** `transformContext`

Modify `AgentMessage[]` before sending to LLM:

```typescript
transformContext: async (messages, signal) => {
  // Remove certain messages
  // Inject context from external source
  // Summarize on-the-fly
  return filteredMessages;
}
```

**Difference from convertToLlm:**
- `transformContext`: AgentMessage[] → AgentMessage[] (app-level)
- `convertToLlm`: AgentMessage[] → LLM Message[] (protocol-level)

---

### **14. Steering & Follow-up Messages**

**AgentOptions:**
- `getSteeringMessages()` - Inject mid-run
- `getFollowUpMessages()` - After agent would stop

**Use cases:**
- Background tasks completion
- Multi-turn workflows
- Automated retries

---

## 🟡 **15-28: UI & INTERACTION CUSTOMIZATION** (Trung)

### **15. Slash Commands Registration**

**API:** `api.registerCommand(name, definition)`

```typescript
api.registerCommand("deploy", {
  description: "Deploy to environment",
  getArgumentCompletions: (prefix) => [
    { label: "staging" },
    { label: "production" },
  ],
  handler: async (args, ctx) => {
    const env = args.trim();
    await ctx.exec("./deploy.sh", [env]);
  },
});
```

**Usage:** `/deploy staging` trong editor.

**Auto-complete:** Tab completion với `getArgumentCompletions`.

---

### **16-17. UI Widgets (Above/Below Editor)**

**API:**
```typescript
api.ui.setWidget("status", ["✓ Ready"], { placement: "aboveEditor" });
api.ui.setWidget("progress", ["50%"], { placement: "belowEditor" });
```

**Placement:** `"aboveEditor"` | `"belowEditor"`

**Content:** `string[]` hoặc factory component.

**Multiple widgets:** Key-based, auto-replaces.

---

### **18. Custom Footer/Header**

**Footer (with data):**
```typescript
api.ui.setFooter((tui, theme, footerData) => {
  return new MyFooterComponent(tui, theme, footerData);
});
```

**Header:**
```typescript
api.ui.setHeader((tui, theme) => {
  return new MyHeaderComponent(tui, theme);
});
```

**Factory only:** Pass `undefined` to restore default.

---

### **19. Autocomplete Provider Wrapper**

**API:** `api.ui.addAutocompleteProvider(factory)`

```typescript
api.ui.addAutocompleteProvider((currentProvider) => ({
  ...currentProvider,
  getSuggestions: async (context) => {
    const defaultSugs = await currentProvider.getSuggestions?.(context);
    return [
      ...defaultSugs,
      { label: "@my-ref", type: "custom", detail: "My custom ref" },
    ];
  },
}));
```

**Stackable:** Multiple wrappers, called in order.

---

### **20. Custom Editor Component**

**API:** `api.ui.setEditorComponent(factory)`

```typescript
api.ui.setEditorComponent((tui, theme, keybindings) => {
  return new VimEditor(tui, theme, keybindings); // extends CustomEditor
});
```

**Restore:** Pass `undefined`.

**Get current:** `api.ui.getEditorComponent()`.

**Key requirement:** Xử lý phím app-level (escape, ctrl+d, etc.) bằng gọi `super.handleInput()`.

---

### **21. Notification System**

**API:** `api.ui.notify(message, type)`

```typescript
api.ui.notify("Build complete!", "success");
api.ui.notify("Error occurred", "error");
api.ui.notify("Info message", "info");
```

**Types:** `"info"` | `"warning"` | `"error"`

**Non-blocking:** Toast-style, auto-dismiss.

---

### **22. Dialog Primitives**

**API ( synchronous trong handler):**
```typescript
const choice = await api.ui.select("Title", ["Option 1", "Option 2"]);
const confirmed = await api.ui.confirm("Confirm", "Are you sure?");
const input = await api.ui.input("Name", "Enter name");
```

**Options:** `signal`, `timeout` trong `ExtensionUIDialogOptions`.

**Blocking:** Handler tạm dừng đến khi user chọn.

---

### **23. Keybinding Override**

**Access:** `ctx.ui.keybindings` (KeybindingsManager)

**Read:**
```typescript
const keys = ctx.ui.keybindings.getKeys("tui.editor.cursorUp");
const def = ctx.ui.keybindings.getDefinition("tui.input.submit");
```

**User overrides:** `ctx.ui.keybindings.setUserBindings({...})`

**Conflicts:** `getConflicts()` returns duplicate key bindings.

**Default bindings:** TUI_KEYBINDINGS constant (editor, input, select).

---

### **24. Theme System**

**Access:** `api.ui.theme`

**Methods:**
```typescript
api.ui.theme.getAllThemes(); // [{ name, path }]
api.ui.theme.getTheme("dark");
api.ui.setTheme("dark") || api.ui.setTheme(customThemeObject);
```

**Theme object:**
```typescript
{
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    border: string;
    // ...
  };
}
```

**Syntax highlighting:** Built-in, auto-detects language.

---

### **25. Working Indicator (Spinner)**

**API:**
```typescript
api.ui.setWorkingIndicator({
  frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  intervalMs: 80,
});
api.ui.setWorkingIndicator({ frames: ["●"] }); // static
api.ui.setWorkingIndicator({ frames: [] }); // hide
```

**Default:** Animated spinner.

**During streaming:** Shows while LLM thinking.

---

### **26. Tool Output Expansion Toggle**

**API:**
```typescript
const expanded = api.ui.getToolsExpanded();
api.ui.setToolsExpanded(true); // show all tool outputs
api.ui.setToolsExpanded(false); // collapse by default
```

**User can toggle:** Via `/tools` command usually.

---

### **27. Image Display Toggle**

**Settings:** `"imageDisplay": "auto" | "always" | "never"`

**Programmatic:** `ctx.ui` doesn't expose directly，but `showImages` in tool context.

**In tool render:** Check `context.showImages`.

---

### **28. Status Bar Customization**

**API:** `api.ui.setStatus(key, text | undefined)`

```typescript
api.ui.setStatus("custom:build", "Building...");
// Later:
api.ui.setStatus("custom:build", undefined); // clear
```

**Built-in keys:** `"model"`, `"session"`, `"tokens"`, etc.

**Footer data:** Available via footer factory `footerData`.

---

## 🟢 **29-43: CONFIGURATION & RESOURCES** (Thấp)

### **29. Main Config: `~/.piclaw/config.json`**

```json
{
  "model": "anthropic:claude-opus-4-5",
  "thinking": "high",
  "tools": ["read", "bash", "edit", "write"],
  "verbose": false,
  "sessionDir": "~/.piclaw/sessions",
  "noContextFiles": false,
  "contextLogFile": null,
  "scopedModels": []
}
```

**Override:** CLI flags (`--model`, `--thinking`, etc.)

---

### **30. Settings: `~/.piclaw/agent/settings.json`**

```json
{
  "extensions": ["/path/to/ext.ts"],
  "imageDisplay": "auto",
  "theme": "default",
  "allowDangerousTools": true,
  "disabledTools": ["rm", "format"],
  "skillPaths": [],
  "promptPaths": [],
  "themePaths": [],
  "customProvidersPath": null,
  "modelsPath": null,
  "logLevel": "info",
  "compact": {
    "enabled": true,
    "maxContextTokens": 180000,
    "autoCompact": true,
    "keepLastN": 10
  }
}
```

**Auto-generated:** Some keys added by Piclaw.

---

### **31. Auth: `~/.piclaw/auth.json`**

```json
{
  "anthropic": "sk-ant-...",
  "openai": "sk-...",
  "google": "..."
}
```

**Auto-save:** Via `/login` command.

---

### **32. Context Files (AGENTS.md, SYSTEM.md, APPEND_SYSTEM.md)**

**Locations:** `~/.pi/agent/`, `.pi/`, parent dirs (walk up).

**Merging order:** Global → Ancestor → Project (later overrides).

**Types:**
- `AGENTS.md` - Append rules (coding standards)
- `SYSTEM.md` - Full override system prompt
- `APPEND_SYSTEM.md` - Append to end of system prompt

**Disable:** `"noContextFiles": true` hoặc `--no-context-files`.

---

### **33. Skills (Markdown)**

**Location:**
- `~/.pi/agent/skills/`
- `.pi/skills/`
- Custom paths từ `settings.json`

**Format:** `SKILL.md` với frontmatter optional:

```markdown
# Deploy to {{environment}}

## Steps
1. `npm test`
2. `npm run build`
3. `./deploy.sh {{environment}}`

## Notes
- Always backup
```

**Usage:** `/skill:deploy production`

**Auto-suggest:** Piclaw suggests when context matches.

---

### **34. Prompt Templates (Markdown)**

**Location:**
- `~/.pi/agent/prompts/`
- `.pi/prompts/`

**Format:** Template với `{{variables}}`:

```markdown
# Code Review

Review this code:

{{code}}

Focus: {{focus}}
```

**Usage:** `/review` → expands → fill → send.

**Variables:** `{{code}}`, `{{file}}`, `{{context}}`, `{{date}}`, custom.

---

### **35. Themes (JSON)**

**Location:**
- Built-in: `default`, `dark`, `light`
- User: `~/.pi/agent/themes/*.json`
- Package: npm package with `themes/` folder

**Format:**
```json
{
  "name": "My Theme",
  "colors": {
    "background": "#1a1a2e",
    "foreground": "#e6e6e6",
    "primary": "#00d4aa"
  }
}
```

**Register:** Via `settings.json` paths hoặc install package.

---

### **36-39. Resource Paths (Extensions, Skills, Prompts, Themes)**

**Settings keys:**
```json
{
  "extensions": ["/local/path", "npm:package", "git:repo"],
  "skillPaths": ["/skills"],
  "promptPaths": ["/prompts"],
  "themePaths": ["/themes"]
}
```

**Sources:**
- Local path: `/abs/path` or `./relative`
- NPM: `npm:package-name`
- Git: `git:github.com/user/repo`
- CLI: extension passed via `--extension` flag

---

### **40. CLI Flags (Startup)**

```bash
piclaw [options] [prompt]

--cwd <path>              Working directory
--model <id>              Model ID
--thinking <level>        Thinking level
--tools <list>            Allowlist tools (comma-separated)
--sessionDir <dir>        Session storage
--verbose                 Debug logging
--no-context-files        Disable AGENTS.md, etc.
--print                   Non-interactive print mode
--mode <mode>             interactive|print|rpc
--import <file>           Import session on startup
--session <path>          Open specific session
--extension <path>        Load extension (can repeat)
--tool <name>             Enable tool (overrides allowlist)
--logFile <path>          Log to file
--contextLogFile <path>   Log context changes
```

**Multiple:** Can combine.

---

### **41. Environment Variables**

**API Keys:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...
export DEEPSEEK_API_KEY=...
```

**Provider-specific:** Check provider docs.

**Piclaw env:**
- `PICLAW_DEBUG` - Enable debug logs
- `PICLAW_NO_COLOR` - Disable colors
- `TERM` - Terminal type (auto-detected)

---

### **42. Custom Models: `~/.piclaw/models.json`**

```json
{
  "providers": {
    "custom-ai": {
      "baseUrl": "https://api.custom.com/v1",
      "apiKey": "CUSTOM_API_KEY_ENV",
      "api": "openai-chat-completions",
      "headers": { "X-Custom": "value" },
      "models": [
        {
          "id": "my-model",
          "name": "My Model",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0.1, "output": 0.3 },
          "contextWindow": 16384,
          "maxTokens": 8192
        }
      ]
    }
  }
}
```

**Reload:** `/reload` or restart.

---

### **43. Package Manager Integration**

**Detection:** `detectInstallMethod()` in `config.ts`

**Methods:** `npm`, `pnpm`, `yarn`, `bun`, `bun-binary`

**Self-update:** `getSelfUpdateCommandForMethod()`

**Use:** Piclaw can self-update if installed globally.

---

## 🎨 **ADDITIONAL TUICUSTOMIZATION POINTS** (từ `pi-tui`)

### **A. Component System**

**Base:** `Component` interface với `render(width): string[]`

**Built-in components (30+):**
- `Box`, `Text`, `Spacer`
- `Editor` (multi-line editor)
- `Input` (single-line)
- `SelectList` (selection UI)
- `SettingsList` (settings UI)
- `Markdown` (markdown renderer)
- `Loader`, `CancellableLoader`
- `Image`
- `DynamicBorder`

**Custom component:** Implement `render()`, optional `handleInput()`, `invalidate()`.

---

### **B. Keybindings Manager**

**Access:** `tui.keybindings` (global)

**Custom bindings:**
```typescript
const km = new KeybindingsManager(TUI_KEYBINDINGS, {
  "app.mycommand": "ctrl+shift+m",
});
tui.setKeybindings(km);
```

**Check conflicts:** `km.getConflicts()`

**Resolve:** `km.matches(data, "tui.input.submit")`

---

### **C. Overlay System**

**Show overlay:**
```typescript
const handle = tui.showOverlay(component, {
  width: "80%",
  height: "50%",
  anchor: "center",
  margin: 2,
});
```

**Control:** `handle.hide()`, `handle.focus()`, `handle.setHidden(true)`

**Factory:** Component factory receives `(tui, theme, keybindings, done)`.

---

### **D. Terminal Capabilities**

**Detect:**
- Kitty protocol (images, key release)
- iTerm2 protocol (images)
- Sixel support
- Color support
- Cursor style

**Set:** `setCapabilities()` manually if auto-detect fails.

---

### **E. Clipboard API**

**Access:** `navigator.clipboard` trong browser, hoặc `clipboard` module trong Node.

**TUI doesn't provide,** but extensions can use `clipboard` npm package.

---

### **F. Undo/Redo Stack**

**Component:** `UndoStack` class

**Use:** Wrap editor operations.

**Not exposed globally,** but can be instantiated in custom components.

---

### **G. Fuzzy Matching**

** Utilities:** `fuzzyMatch()`, `fuzzyFilter()`

**Use:** Custom autocomplete, select lists.

**Exported:** From `tui` package.

---

## 🔧 **KHÔNG THỂ CAN THIỆP** (Hard Limits)

1. **Không thể sửa core pi-agent-core** (dùng extension hooks thay)
2. **Không thể sửa pi-tui rendering engine** (dùng custom components)
3. **Không thể thay đổi LLM protocol ngoài `convertToLlm`** (vẫn phải đúng format)
4. **Không thể access internals của Agent class** (chỉ qua events)
5. **Không thể disable built-in tools** (chỉ có thể không include chúng)
6. **Khôngẽ override session persistence format** (FILE format cố định)
7. **Không thể access session của session khác** (chỉ navigation qua tree)
8. **Không thể modify messages của assistant sau khi đã stream** (chỉ modify context trước)

---

## 🎯 **BẢNG TỔNG HỢP ĐẦY ĐỦ**

| # | Hook Point | Type | Location | Customization Level |
|---|------------|------|----------|---------------------|
| 1 | AgentOptions.convertToLlm | Function | pi-agent-core | Message transform |
| 2 | AgentOptions.streamFn | Function | pi-agent-core | LLM streaming |
| 3 | AgentOptions.transformContext | Function | pi-agent-core | Context pre-process |
| 4 | AgentOptions.getApiKey | Function | pi-agent-core | Auth |
| 5 | AgentOptions.beforeToolCall | Hook | pi-agent-core | Tool block |
| 6 | AgentOptions.afterToolCall | Hook | pi-agent-core | Result override |
| 7 | AgentOptions.shouldStopAfterTurn | Hook | pi-agent-core | Termination |
| 8 | AgentOptions.getSteeringMessages | Function | pi-agent-core | Mid-run inject |
| 9 | AgentOptions.getFollowUpMessages | Function | pi-agent-core | Post-run inject |
| 10 | AgentOptions.toolExecution | Enum | pi-agent-core | Parallel/sequential |
| 11 | AgentEvent subscription | Events | pi-agent-core | Monitor all |
| 12 | Extension API registerTool | Tool | coding-agent | LLM-callable tools |
| 13 | Extension API registerCommand | Command | coding-agent | Slash commands |
| 14 | Extension API registerProvider | Provider | coding-agent | LLM providers |
| 15 | Extension API registerShortcut | Shortcut | coding-agent | Keybindings |
| 16 | Extension API registerFlag | Flag | coding-agent | CLI flags |
| 17 | Extension API on(event, handler) | Events | coding-agent | 25+ events |
| 18 | Extension API ui.setWidget | UI | coding-agent | Widgets |
| 19 | Extension API ui.setFooter | UI | coding-agent | Footer |
| 20 | Extension API ui.setHeader | UI | coding-agent | Header |
| 21 | Extension API ui.notify | UI | coding-agent | Toasts |
| 22 | Extension API ui.select/confirm/input | UI | coding-agent | Dialogs |
| 23 | Extension API ui.setEditorComponent | UI | coding-agent | Editor |
| 24 | Extension API ui.addAutocompleteProvider | UI | coding-agent | Autocomplete |
| 25 | Extension API ui.setTheme | UI | coding-agent | Colors |
| 26 | Extension API ui.setWorkingIndicator | UI | coding-agent | Spinner |
| 27 | Extension API ui.setStatus | UI | coding-agent | Status bar |
| 28 | Extension API ui.setToolsExpanded | UI | coding-agent | Tool output |
| 29 | CustomToolCallEvent.return value | Override | coding-agent | Tool call modify |
| 30 | CustomToolResultEvent.return value | Override | coding-agent | Result modify |
| 31 | ContextEvent.return value | Override | coding-agent | Messages modify |
| 32 | BeforeProviderRequestEvent.return | Override | coding-agent | Request modify |
| 33 | ResourcesDiscoverEvent.return | Resource | coding-agent | Paths |
| 34 | ToolDefinition.renderCall | UI | coding-agent | Tool call UI |
| 35 | ToolDefinition.renderResult | UI | coding-agent | Tool result UI |
| 36 | MessageRenderer registration | UI | coding-agent | Custom message types |
| 37 | AgentLoopConfig AgentOptions | Config | agent-core | Already counted |
| 38 | SettingsManager.get/set | Config | coding-agent | Settings |
| 39 | Config files (JSON) | Config | coding-agent | Persistent |
| 40 | Context files (MD) | Config | coding-agent | System prompt |
| 41 | Skills (MD) | Resource | coding-agent | Workflows |
| 42 | Prompt templates (MD) | Resource | coding-agent | Prompts |
| 43 | Themes (JSON) | UI | coding-agent | Colors |
| 44 | Extension paths | Config | coding-agent | Load order |
| 45 | Model list override | Config | coding-agent | Providers |
| 46 | CLI flags | Config | coding-agent | Startup |
| 47 | Environment variables | Config | All | Auth |
| 48 | AuthStorageBackend | Auth | agent-core | Custom auth |
| 49 | PackageManager override | System | coding-agent | Install method |
| 50 | TUI Component system | UI | tui | Full UI |
| 51 | TUI KeybindingsManager | UI | tui | Shortcuts |
| 52 | TUI Overlay system | UI | tui | Popups |
| 53 | TUI Autocomplete | UI | tui | Suggestions |
| 54 | TUI Theme | UI | tui | Colors |
| 55 | TUI Custom Editor | UI | tui | Editor component |
| 56 | TUI Fuzzy matching | Util | tui | Search |
| 57 | TUI Terminal capabilities | System | tui | Features |
| 58 | SessionManager direct access | Data | coding-agent | Read/write |
| 59 | ModelRegistry direct access | Data | coding-agent | Models |
| 60 | EventBus direct access | System | coding-agent | Pub/sub |

**Tổng thực tế:** 60+ điểm can thiệp riêng biệt.

---

## 📝 **LỜI KHUYÊN: DÙNG NHƯ THẾ NÀO**

### **Light Touch (Không cần code):**
- Context files (AGENTS.md)
- Settings/config JSON
- Skills/prompts markdown
- Themes JSON
- CLI flags
- Env vars

### **Medium (1-2 file extension):**
- Slash commands
- Custom tools (simple)
- UI widgets
- Theme switching
- Notifications
- Dialogs
- Keybinding tweaks

### **Heavy (Full extension):**
- Event listeners (multiple)
- Tool rendering custom
- Message renderer
- Provider registration
- Auth backend
- Session control
- Context manipulation
- Steering/follow-up
- Multiple integrations

---

## 🎯 **KẾT LUẬN**

**Piclaw có 60+ điểm can thiệp**, từ nhẹ (config) đến sâu (event system).

**Phần lớn qua Extension API:**
- 25+ event types có thể listen
- 10+ UI methods
- 5+ registration methods (tool, command, provider, shortcut, flag)
- Resource discovery
- Direct service access (sessionManager, modelRegistry, eventBus)

**Kiến trúc mở:** Không cần fork core.

**Dual layer:**
- Runtime: npm package
- Reasoning: llm-context source

**Best practice:** Dùng extension, đừng sửa core.

---

*Phân tích từ source code: llm-context/packages/{agent,coding-agent,tui}/*
*Ngày: 2026-05-06*