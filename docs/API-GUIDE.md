# Pi Coding Agent - Extension API Guide

**Tài liệu tổng hợp đầy đủ API để viết extensions cho piclaw.**

---

## 📖 Mục lục

1. [Giới thiệu](#giới-thiệu)
2. [Core Concepts](#core-concepts)
3. [Registration Methods](#registration-methods)
4. [Event System](#event-system)
5. [Execution & Control](#execution--control)
6. [Session & Model Management](#session--model-management)
7. [UI Interaction](#ui-interaction)
8. [Navigation & Control](#navigation--control)
9. [Resource Loading](#resource-loading)
10. [Inter-Extension Communication](#inter-extension-communication)
11. [Tips & Best Practices](#tips--best-practices)

---

## Giới thiệu

Pi-coding-agent cung cấp **Extension API** cho phép mở rộng hệ thống thông qua các extension. Extension có thể:

- Đăng ký tools mà LLM có thể sử dụng
- Đăng ký slash commands, keyboard shortcuts, CLI flags
- Lắng nghe và phản ứng với sự kiện hệ thống
- Tương tác với UI (dialogs, notifications, widgets)
- Quản lý session, model switching, context compaction
- Gửi messages và điều khiển agent

**Entry point:** Mỗi extension là một file có **default export** nhận `api: ExtensionAPI`:

```typescript
// src/extensions/my-extension.ts
export default function (api: ExtensionAPI) {
  // Đăng ký tools, commands, shortcuts,...
  // Lắng nghe events
}
```

---

## Core Concepts

### ExtensionAPI vs ExtensionContext

| ExtensionAPI | ExtensionContext |
|--------------|------------------|
| Được truyền vào default export function | Được truyền vào event handlers, command handlers, tool execute |
| Dùng để **đăng ký** (register) | Dùng để **hành động** (exec, ui, session control) |
| Các method: `registerTool()`, `registerCommand()`, `on()`,... | Các method: `exec()`, `sendMessage()`, `ui.select()`, `fork()`,... |
| Có từ đầu, trước khi session chạy | Có khi session đang chạy, event xảy ra |

**Ví dụ:**

```typescript
// ExtensionAPI dùng ở đâu?
export default function (api: ExtensionAPI) {
  api.registerTool({ ... });  // ✅ OK
  api.on("agent_end", (ctx) => {
    // ctx bây giờ là ExtensionContext
    ctx.exec("git", ["status"]);  // ✅ OK
    ctx.ui.notify("Done!");       // ✅ OK
  });
}
```

---

### Context Types Hierarchy

```
ExtensionContext (base)
├── hasUI: boolean
├── cwd: string
├── sessionManager: ReadonlySessionManager
├── modelRegistry: ModelRegistry
├── model: Model | undefined
├── isIdle(): boolean
├── signal: AbortSignal | undefined
├── abort(): void
├── hasPendingMessages(): boolean
├── shutdown(): void
├── getContextUsage(): ContextUsage | undefined
├── compact(options?: CompactOptions): void
├── getSystemPrompt(): string
└── ui: ExtensionUIContext

ExtensionCommandContext (extended)
├── waitForIdle(): Promise<void>
├── newSession(options?): Promise<{ cancelled: boolean }>
├── fork(entryId, options?): Promise<{ cancelled: boolean }>
├── navigateTree(targetId, options?): Promise<{ cancelled: boolean }>
├── switchSession(path, options?): Promise<{ cancelled: boolean }>
└── reload(): Promise<void>
```

**Khi nào dùng cái nào?**

- **Tool execute, event handlers**: nhận `ctx: ExtensionContext`
- **Slash command handlers**: nhận `ctx: ExtensionCommandContext` (có thêm quyền điều khiển session)

---

## Registration Methods

### 1. `api.registerTool(tool: ToolDefinition)`

Đăng ký một custom tool mà LLM có thể gọi.

**ToolDefinition structure:**

```typescript
interface ToolDefinition<TParams = any, TDetails = unknown, TState = any> {
  name: string;                    // Tên tool (dùng trong LLM calls)
  label?: string;                  // Tên hiển thị (UI)
  description: string;             // Mô tả công dụng
  promptSnippet?: string;          // Gợi ý cách dùng (hướng dẫn LLM)
  promptGuidelines?: string[];     // Các nguyên tắc khi dùng tool
  parameters: TSchema;             // JSON Schema cho params (typebox)
  execute: ToolExecutor<TParams, TDetails, TState>;
  renderToolCall?(): ToolRenderResult;  // Custom UI render
  renderToolResult?(): ToolRenderResult;
  canRender?(): boolean;
}

type ToolExecutor<TParams, TDetails, TState> = (
  toolCallId: string,
  params: TParams,
  signal: AbortSignal | undefined,
  onUpdate: (update: ToolRenderResult) => void,
  ctx: ExtensionContext
) => Promise<ToolResult<TDetails> | Stream<AgentMessage>>;

interface ToolResult<TDetails = unknown> {
  content: AgentMessage["content"];
  details?: TDetails;
  metadata?: Record<string, any>;
}
```

**Ví dụ đầy đủ:**

```typescript
// src/extensions/tools/example-tool.ts
import type { ExtensionAPI, ToolDefinition, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export function registerExampleTool(api: ExtensionAPI): void {
  const tool: ToolDefinition = {
    name: "example",
    label: "Example Tool",
    description: "Một tool ví dụ để demo",
    promptSnippet: "Use `example` to demonstrate custom tool integration.",
    promptGuidelines: [
      "Chỉ gọi tool này khi user yêu cầu demo.",
      "Tool này chỉ để minh họa, không có tác dụng thực tế."
    ],
    parameters: Type.Object({
      message: Type.String({ description: "Message để xử lý" }),
      count: Type.Number({ description: "Số lần lặp", default: 1 })
    }),
    execute: async (toolCallId, params, signal, onUpdate, ctx) => {
      const { message, count } = params as any;

      // Gửi update trong khi chạy
      onUpdate({
        content: [{ type: "text", text: `Đang xử lý: ${message} (x${count})` }],
        isPartial: true
      });

      // Có thể dùng ctx.exec để chạy shell command
      const result = await ctx.exec("echo", [message]);

      // Trả về kết quả cuối cùng
      return {
        content: [{ type: "text", text: `Đã xử lý xong: ${message}` }],
        details: { echoResult: result.stdout, count }
      };
    },
    renderToolCall: () => ({
      content: [{ type: "text", text: "🚀 Đang gọi example tool..." }],
      isPartial: true
    }),
    renderToolResult: (toolCall, result, isPartial) => ({
      content: result.content,
      details: result.details,
      isPartial
    })
  };

  api.registerTool(tool);
}
```

**Lưu ý:**

- `parameters` dùng **TypeBox** schema (không phải JSON Schema thuần). Import từ `@sinclair/typebox`.
- `execute` nhận `ctx: ExtensionContext` để tương tác với hệ thống.
- `onUpdate` cho phép streaming updates (partial results).
- `signal` để hủy khi user abort.

---

### 2. `api.registerProvider(name: string, config: ProviderConfig)`

Đăng ký custom model provider (như OpenAI, Anthropic, Kilo,...).

**ProviderConfig:**

```typescript
interface ProviderConfig {
  name?: string;                      // Tên hiển thị (UI)
  baseUrl?: string;                   // Base URL cho API endpoint (bắt buộc nếu có models)
  apiKey?: string;                    // Environment variable name hoặc literal key
  api?: Api;                          // API type: "openai-completions", "anthropic-messages",...
  streamSimple?: (model, context, options?) => AssistantMessageEventStream;
  headers?: Record<string, string>;   // Custom headers
  authHeader?: boolean;               // Thêm Authorization: Bearer <apiKey>
  models?: ProviderModelConfig[];     // Danh sách models (nếu có)
  oauth?: {                           // OAuth support cho /login
    name: string;
    login(callbacks): Promise<OAuthCredentials>;
    refreshToken(credentials): Promise<OAuthCredentials>;
    getApiKey(credentials): string;
    modifyModels?(models, credentials)?: Model[];
  };
}
```

**ProviderModelConfig:**

```typescript
interface ProviderModelConfig {
  id: string;                         // Model ID (e.g., "claude-sonnet-4")
  name: string;                       // Display name
  api?: Api;                          // Override API type
  baseUrl?: string;                   // Override base URL cho model này
  reasoning: boolean;                 // Có hỗ trợ extended thinking?
  input: readonly ("text" | "image")[];  // Input modalities
  cost: {
    input: number;                    // $/1M input tokens
    output: number;                   // $/1M output tokens
    cacheRead?: number;
    cacheWrite?: number;
  };
  maxMegapixels?: number;            // For vision models
  contextWindow: number;              // Context size (tokens)
  maxTokens: number;                  // Max output tokens
}
```

**Ví dụ:**

```typescript
// src/extensions/providers/kilo-provider.ts
import { KILO_MODELS_ALL } from "./models/index.js";

export function registerKiloProvider(api: ExtensionAPI): void {
  const baseUrl = KILO_MODELS_ALL[0]?.baseUrl || "https://api.kilo.ai/api/gateway";

  const config: ProviderConfig = {
    name: "Kilo Gateway",
    baseUrl,
    apiKey: "KILO_API_KEY",  // Đọc từ env var
    api: "openai-completions",
    models: KILO_MODELS_ALL,
    authHeader: true,
  };

  api.registerProvider("kilo", config);
}
```

**Cũng có `api.unregisterProvider(name)` để xóa provider.**

---

### 3. `api.registerCommand(name: string, options: RegisteredCommand)`

Đăng ký slash command mà user có thể gõ (bắt đầu bằng `/`).

```typescript
interface RegisteredCommand {
  description: string;
  handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> | void;
  args?: string;                     // Argparse-like spec (hoặc free-form)
  hidden?: boolean;                  // Ẩn command khỏi help
}
```

**Ví dụ:**

```typescript
api.registerCommand("gnp", {
  description: "Toggle auto-continue: bật/tắt tự động gửi message khi idle",
  handler: async (args: string, ctx: ExtensionCommandContext) => {
    // Logic xử lý command
    if (ctx.hasUI) {
      ctx.ui.notify("Auto-continue đã BẬT", "info");
    }
    // Có thể điều khiển session
    await ctx.waitForIdle();
    await ctx.switchSession("./sessions/other.json");
  }
});
```

**Lưu ý:** `ExtensionCommandContext` cho phép `newSession`, `fork`, `navigateTree`, `switchSession`, `reload`.

---

### 4. `api.registerShortcut(shortcut: KeyId, options: { description?, handler })`

Đăng ký keyboard shortcut (keybinding) toàn cục.

```typescript
// KeyId format: "ctrl+n", "alt+enter", "escape", etc.
api.registerShortcut("ctrl+shift+t", {
  description: "Toggle theme",
  handler: (ctx: ExtensionContext) => {
    ctx.ui.setTheme("dark");
  }
});
```

---

### 5. `api.registerFlag(name: string, options: { description, type, default? })`

Thêm CLI flag cho executable.

```typescript
api.registerFlag("my-flag", {
  description: "Flag mô tả chức năng",
  type: "boolean",  // hoặc "string"
  default: false
});

// Usage: piclaw --my-flag
// Đọc giá trị: api.getFlag("my-flag")
```

---

### 6. `api.registerMessageRenderer<T>(customType: string, renderer: MessageRenderer<T>)`

Custom renderer cho message type (đăng ký với `appendEntry`).

```typescript
api.registerMessageRenderer<MyData>("my-custom-type", (entry, ctx) => {
  return {
    // Component factory
    component: (tui, theme) => ({
      draw(tui) { tui.drawText(`Custom: ${entry.data}`); }
    }),
    // Hoặc string[]
    lines: [`Custom entry: ${JSON.stringify(entry.data)}`]
  };
});

// Sau đó có thể dùng:
api.appendEntry("my-custom-type", { foo: "bar" });
```

---

## Event System

### `api.on(event: string, handler: (ctx, ...args) => void): void`

Lắng nghe sự kiện từ hệ thống. Kiểu `ctx` phụ thuộc vào event.

**Danh sách sự kiện:**

| Event | Khi nào xảy ra | Handler args | Context type |
|-------|----------------|--------------|--------------|
| `resources_discover` | Khi cần discover resources (prompts, skills, themes) | `(ctx) => ResourceDiscoveryResult` | `ExtensionContext` |
| `session_start` | Session mới bắt đầu | `(ctx, event)` | `ExtensionContext` |
| `session_before_switch` | Trước khi chuyển session | `(ctx, event) => SessionBeforeSwitchResult` | `ExtensionContext` |
| `session_before_fork` | Trước khi fork session | `(ctx, event) => SessionBeforeForkResult` | `ExtensionContext` |
| `session_before_compact` | Trước khi compact context | `(ctx, event) => SessionBeforeCompactResult` | `ExtensionContext` |
| `session_compact` | Sau khi compact xong | `(ctx, event)` | `ExtensionContext` |
| `session_shutdown` | Session shutdown | `(ctx, event)` | `ExtensionContext` |
| `session_before_tree` | Trước khi render session tree | `(ctx, event) => SessionBeforeTreeResult` | `ExtensionContext` |
| `session_tree` | Sau khi render session tree | `(ctx, event)` | `ExtensionContext` |
| `context` | Context thay đổi (token count) | `(ctx, event) => ContextEventResult` | `ExtensionContext` |
| `before_provider_request` | Trước khi gửi request đến provider | `(ctx, event) => BeforeProviderRequestEventResult` | `ExtensionContext` |
| `after_provider_response` | Sau khi nhận response từ provider | `(ctx, event)` | `ExtensionContext` |
| `before_agent_start` | Trước khi agent bắt đầu turn | `(ctx, event) => BeforeAgentStartEventResult` | `ExtensionContext` |
| `agent_start` | Agent bắt đầu streaming | `(ctx, event)` | `ExtensionContext` |
| `agent_end` | Agent kết thúc streaming | `(ctx, event)` | `ExtensionContext` |
| `turn_start` | Bắt đầu một turn mới | `(ctx, event)` | `ExtensionContext` |
| `turn_end` | Kết thúc turn | `(ctx, event)` | `ExtensionContext` |
| `message_start` | Bắt đầu stream message | `(ctx, event)` | `ExtensionContext` |
| `message_update` | Message đang stream (chunk) | `(ctx, event)` | `ExtensionContext` |
| `message_end` | Message kết thúc | `(ctx, event) => MessageEndEventResult` | `ExtensionContext` |
| `tool_execution_start` | Tool bắt đầu chạy | `(ctx, event)` | `ExtensionContext` |
| `tool_execution_update` | Tool đang chạy (update) | `(ctx, event)` | `ExtensionContext` |
| `tool_execution_end` | Tool kết thúc | `(ctx, event)` | `ExtensionContext` |
| `tool_call` | LLM gọi tool | `(ctx, event) => ToolCallEventResult` | `ExtensionContext` |
| `tool_result` | Tool trả về kết quả | `(ctx, event) => ToolResultEventResult` | `ExtensionContext` |
| `user_bash` | User chạy bash command | `(ctx, event) => UserBashEventResult` | `ExtensionContext` |
| `input` | User nhấn Enter trong input editor | `(ctx, event) => InputEventResult` | `ExtensionContext` |
| `model_select` | User đổi model | `(ctx, event)` | `ExtensionContext` |
| `thinking_level_select` | User đổi thinking level | `(ctx, event)` | `ExtensionContext` |

**Ví dụ:**

```typescript
api.on("agent_end", (ctx) => {
  console.log("Agent finished streaming");
});

api.on("tool_call", (ctx, event) => {
  console.log(`Tool called: ${event.toolCall.name}`);
});

api.on("session_start", (ctx, event) => {
  if (ctx.hasUI) {
    ctx.ui.notify(`Session started: ${ctx.cwd}`, "info");
  }
});

// Có thể return result để can thiệp
api.on("before_provider_request", (ctx, event) => {
  // Thêm headers
  event.request.headers["X-Custom"] = "value";
  return { allow: true };
});

api.on("session_before_switch", async (ctx, event) => {
  // Confirm với user trước khi chuyển
  if (ctx.hasUI) {
    const ok = await ctx.ui.confirm(
      "Chuyển session?",
      `Bạn có chắc muốn chuyển sang ${event.targetSessionPath}?`
    );
    return { cancelled: !ok };
  }
});
```

---

## Execution & Control

### Gửi Messages

| Method | Mô tả |
|--------|-------|
| `ctx.sendUserMessage(content, options?)` | Gửi tin nhắn user, luôn trigger turn. `content` có thể là string hoặc array của `{type: "text", text}`, `{type: "image", image}` |
| `ctx.sendMessage(message, options?)` | Gửi custom message (không phải user message). `message = { customType, content, display?, details? }`. `options.triggerTurn` (default false), `deliverAs: "steer" \| "followUp" \| "nextTurn"` |
| `ctx.appendEntry(customType, data?)` | Thêm entry vào session (lưu state, không gửi LLM). Dùng cho persistence. |

**Ví dụ:**

```typescript
// Gửi user message
ctx.sendUserMessage("Hãy liệt kê các file");

// Gửi custom message (trigger turn)
ctx.sendMessage({
  customType: "my-extension-notify",
  content: [{ type: "text", text: "Đã xử lý xong!" }],
  details: { count: 5 }
}, { triggerTurn: true });

// Lưu state vào session
ctx.appendEntry("todo-state", { todos: [...todos], completed: true });
```

---

### Shell Execution

| Method | Mô tả |
|--------|-------|
| `ctx.exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>` | Chạy shell command (giống tool `bash`). Trả về `{ stdout, stderr, exitCode }`. |
| `ctx.exec("npm", ["install"], { cwd: "/path" })` | |

**ExecOptions:**

```typescript
interface ExecOptions {
  cwd?: string;                      // Working directory
  env?: Record<string, string>;      // Environment variables
  timeout?: number;                  // Timeout ms
  stdio?: "inherit" | "pipe" | "ignore";
  shell?: boolean;                   // Dùng shell?
}
```

---

### Session & State

| Method | Mô tả |
|--------|-------|
| `ctx.getActiveTools(): string[]` | Lấy danh sách tên tools đang active |
| `ctx.getAllTools(): ToolInfo[]` | Lấy thông tin tất cả tools (schema, source) |
| `ctx.setActiveTools(toolNames: string[])` | Bật/tắt tools (dynamic tool enable/disable) |
| `ctx.getCommands(): SlashCommandInfo[]` | Lấy danh sách slash commands hiện có |
| `ctx.getSystemPrompt(): string` | Lấy system prompt đang dùng |
| `ctx.getContextUsage(): ContextUsage \| undefined` | Lấy context token stats: `{ tokens, contextWindow, percent }` |
| `ctx.compact(options?: CompactOptions)` | Kích hoạt context compaction (xóa entries cũ) |
| `ctx.setSessionName(name: string)` | Đặt tên session (hiển thị trong selector) |
| `ctx.getSessionName(): string \| undefined` | Lấy tên session hiện tại |
| `ctx.setLabel(entryId: string, label: string \| undefined)` | Đánh dấu entry (bookmark) |
| `ctx.abort()` | Hủy operation đang chạy |
| `ctx.shutdown()` | Tắt piclaw và exit |
| `ctx.hasPendingMessages(): boolean` | Có message đang chờ không? |

**Ví dụ:**

```typescript
// Kiểm tra context usage
const usage = ctx.getContextUsage();
if (usage && usage.percent > 80) {
  await ctx.compact({ customInstructions: "Giữ lại các entry quan trọng" });
}

// Dynamic tool control
const active = ctx.getActiveTools();
if (!active.includes("bash")) {
  ctx.setActiveTools([...active, "bash"]);
}

// Đánh dấu entry
ctx.setLabel(entryId, "important");
```

---

## UI Interaction

Tất cả UI methods nằm trong `ctx.ui` (kiểu `ExtensionUIContext`).

### Dialogs

| Method | Mô tả |
|--------|-------|
| `ctx.ui.select(title, options, opts?): Promise<string \| undefined>` | Hiển thị selector, user chọn 1 option. Trả về giá trị hoặc `undefined` nếu cancel. |
| `ctx.ui.confirm(title, message, opts?): Promise<boolean>` | Xác nhận dialog. |
| `ctx.ui.input(title, placeholder?, opts?): Promise<string \| undefined>` | Ô nhập text. |
| `ctx.ui.editor(title, prefill?): Promise<string \| undefined>` | Multi-line editor. |

**Ví dụ:**

```typescript
// Select
const choice = await ctx.ui.select(
  "Chọn theme",
  ["dark", "light", "solarized"]
);
if (choice) {
  ctx.ui.setTheme(choice);
}

// Confirm
if (await ctx.ui.confirm("Xóa file?", "Bạn có chắc không?")) {
  await ctx.exec("rm", ["file.txt"]);
}

// Input
const name = await ctx.ui.input("Tên mới", "Nhập tên...");
if (name) {
  ctx.ui.notify(`Chào ${name}!`, "info");
}

// Multi-line editor
const content = await ctx.ui.editor("Soạn thảo", "# Tiêu đề\n\nNội dung...");
```

---

### Notifications & Status

| Method | Mô tả |
|--------|-------|
| `ctx.ui.notify(message, type?)` | Hiển thị notification: `"info"`, `"warning"`, `"error"`. |
| `ctx.ui.setStatus(key: string, text: string \| undefined)` | Set status text trong footer. Dùng key khác nhau để nhiều status. `undefined` để clear. |
| `ctx.ui.setWorkingMessage(message?)` | Set message hiển thị khi đang streaming. Omit để restore default. |
| `ctx.ui.setWorkingVisible(visible: boolean)` | Hiện/ẩm working indicator row. |
| `ctx.ui.setWorkingIndicator(options?)` | Cấu hình animation: `{ frames: ["●", "◐", "○"] }`, `frames: []` để ẩn. |

---

### Widgets & Custom Components

| Method | Mô tả |
|--------|-------|
| `ctx.ui.setWidget(key, content, options?)` | Thêm widget UI. `content` có thể là `string[]` (lines) hoặc factory `(tui, theme) => Component`. `options.placement = "aboveEditor" \| "belowEditor"` |
| `ctx.ui.setHeader(factory?)` | Set custom header (ở đầu app, trên chat). `undefined` để restore default. |
| `ctx.ui.setFooter(factory?)` | Set custom footer (trạng thái, token count,...). Factory nhận `FooterDataProvider`. |
| `ctx.ui.custom<T>(factory, options?): Promise<T>` | Hiển thị custom component có keyboard focus. Factory trả về `Component & { dispose?() }`. |
| `ctx.ui.pasteToEditor(text)` | Paste text vào input editor (handle collapse cho large content). |
| `ctx.ui.setEditorText(text)` | Đặt text trong input editor. |
| `ctx.ui.getEditorText(): string` | Lấy text từ input editor. |

**Component interface:**

```typescript
interface Component {
  draw(tui: TUI): void;
  handleInput?(data: string): boolean; // Return true nếu consume
  dispose?(): void;
}
```

**Ví dụ widget:**

```typescript
// Simple widget với text lines
ctx.ui.setWidget("my-widget", [
  "┌─────────────┐",
  "│ My Widget   │",
  "└─────────────┘"
], { placement: "belowEditor" });

// Widget với custom component
ctx.ui.setWidget("progress", (tui, theme) => ({
  progress: 0,
  draw(tui) {
    const bar = "█".repeat(this.progress / 10) + "░".repeat(10 - this.progress / 10);
    tui.drawText(`[${bar}] ${this.progress}%`);
  }
}));
```

---

### Editor Customization

| Method | Mô tả |
|--------|-------|
| `ctx.ui.setEditorComponent(factory?)` | Set custom editor component (ví dụ: vim mode). Factory: `(tui, theme, keybindings) => EditorComponent`. `undefined` restore default. |
| `ctx.ui.getEditorComponent(): EditorFactory \| undefined` | Lấy custom editor factory hiện tại. |
| `ctx.ui.addAutocompleteProvider(factory)` | Stack autocomplete behavior lên trên default. `factory: (current) => AutocompleteProvider`. |

---

### Theme

| Method | Mô tả |
|--------|-------|
| `ctx.ui.setTheme(nameOrTheme)` | Đổi theme. Trả về `{ success: boolean, error?: string }`. |
| `ctx.ui.getTheme(name): Theme \| undefined` | Lấy theme object. |
| `ctx.ui.getAllThemes(): { name, path }[]` | Lấy danh sách tất cả themes (có sẵn + custom). |
| `ctx.ui.getToolsExpanded(): boolean` | Tool output đang expanded không? |
| `ctx.ui.setToolsExpanded(expanded: boolean)` | Mở/rút tất cả tool output. |

---

## Navigation & Control (Command Context Only)

Chỉ có trong **command handlers** (slash commands) và `withSession` callbacks (nhận `ctx: ExtensionCommandContext`).

| Method | Mô tả |
|--------|-------|
| `ctx.waitForIdle(): Promise<void>` | Đợi cho đến khi agent không còn streaming (idle). |
| `ctx.newSession(options?): Promise<{ cancelled: boolean }>` | Tạo session mới. `options.parentSession`, `options.setup`, `options.withSession`. |
| `ctx.fork(entryId, options?): Promise<{ cancelled: boolean }>` | Fork từ entry cụ thể. `options.position: "before" \| "at"`. |
| `ctx.navigateTree(targetId, options?): Promise<{ cancelled: boolean }>` | Điều hướng trong session tree. `options.summarize`, `options.customInstructions`. |
| `ctx.switchSession(path, options?): Promise<{ cancelled: boolean }>` | Chuyển sang session file khác. |
| `ctx.reload(): Promise<void>` | Reload extensions, skills, prompts, themes. |

**Ví dụ:**

```typescript
api.registerCommand("new", {
  description: "Tạo session mới",
  handler: async (args, ctx) => {
    // Tạo session mới, chạy setup function
    await ctx.newSession({
      setup: async (sessionManager) => {
        // Init logic
        await sessionManager.appendEntry("system", {
          customType: "init",
          content: "Session mới được tạo"
        });
      },
      withSession: async (ctx) => {
        // Context đã switch sang session mới
        await ctx.sendUserMessage("Tôi bắt đầu task mới");
      }
    });
  }
});

// Fork từ entry hiện tại
await ctx.fork(ctx.sessionManager.currentSessionEntryId, {
  withSession: async (forkedCtx) => {
    await forkedCtx.sendUserMessage("Đang làm từ điểm này");
  }
});

// Switch sang file session khác
await ctx.switchSession("./sessions/backup.json");

// Reload (như /reload)
await ctx.reload();
```

---

## Session Manager Access

`ctx.sessionManager` (kiểu `ReadonlySessionManager`) cung cấp:

| Property/Method | Mô tả |
|-----------------|-------|
| `ctx.sessionManager.currentSessionPath` | Path của session file hiện tại |
| `ctx.sessionManager.currentSessionEntryId` | Entry ID hiện tại (latest) |
| `ctx.sessionManager.sessionsDir` | Thư mục chứa sessions |
| `ctx.sessionManager.findAll()` | Lấy tất cả sessions |
| `ctx.sessionManager.load(path)` | Load session từ file |
| `ctx.sessionManager.create(path)` | Tạo session mới |
| `ctx.sessionManager.delete(path)` | Xóa session |
| `ctx.sessionManager.recall(targetId?)` | Chuyển đến entry trong tree |

---

## Resource Loading

Extensions có thể cung cấp **resources** (prompts, skills, themes) thông qua event `resources_discover`.

```typescript
api.on("resources_discover", (ctx) => {
  return {
    prompts: [
      {
        name: "my-prompt",
        description: "Prompt tùy chỉnh",
        content: "Bạn là một trợ lý hữu ích..."
      }
    ],
    skills: [
      {
        name: "my-skill",
        description: "Skill definition",
        matches: ["code", "typescript"],
        prompt: "Khi user hỏi về code..."
      }
    ],
    themes: [
      {
        name: "my-theme",
        description: "Theme xanh lá",
        path: "/path/to/theme/file"
      }
    ]
  };
});
```

---

## Inter-Extension Communication

Thông qua **EventBus** `api.events`:

```typescript
// Publish event
api.events.emit("my-event", { data: "hello" });

// Subscribe event
api.events.on("my-event", (payload) => {
  console.log("Received:", payload.data);
});

// One-time listener
api.events.once("my-once-event", (payload) => {
  console.log("Only once");
});

// Remove listener
const handler = (p) => console.log(p);
api.events.on("event", handler);
api.events.off("event", handler);
```

---

## Model Registry

`ctx.modelRegistry` cho phép tìm và inspect models:

```typescript
// Find model by provider:modelId
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4");

// List all models
const allModels = ctx.modelRegistry.getAll();

// Get model by ID (full ID including provider)
const model = ctx.modelRegistry.getById("anthropic/claude-sonnet-4");

// Listen to model changes (when user switches)
api.on("model_select", (ctx, event) => {
  console.log("New model:", event.model.id);
});
```

---

## Utility Methods

| Method | Mô tả |
|--------|-------|
| `api.getFlag(name): boolean \| string \| undefined` | Lấy giá trị CLI flag đã đăng ký. |
| `ctx.isIdle(): boolean` | Agent đang idle (không streaming) không? |
| `ctx.hasUI: boolean` | Có UI không (interactive mode)? False trong print/RPC mode. |
| `ctx.cwd: string` | Working directory hiện tại. |
| `ctx.signal: AbortSignal \| undefined` | Signal hiện tại (để cancel async ops). |
| `ctx.model: Model \| undefined` | Model hiện tại. |

---

## Tips & Best Practices

### 1. Error Handling

```typescript
api.on("agent_end", async (ctx) => {
  try {
    await ctx.exec("git", ["push"]);
  } catch (err: any) {
    if (ctx.hasUI) {
      ctx.ui.notify(`Git push failed: ${err.message}`, "error");
    }
    console.error("Git error:", err);
  }
});
```

### 2. Streaming Updates trong Tool

```typescript
execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  for (let i = 0; i < 10; i++) {
    if (signal?.aborted) throw new Error("Aborted");

    onUpdate({
      content: [{ type: "text", text: `Step ${i + 1}/10...` }],
      isPartial: true
    });
    await delay(500);
  }

  return {
    content: [{ type: "text", text: "Done!" }]
  };
}
```

### 3. Dynamic Tool Enable/Disable

```typescript
api.on("session_start", (ctx) => {
  // Disable bash tool trong certain sessions
  if (ctx.cwd.includes("safe")) {
    const active = ctx.getActiveTools().filter(t => t !== "bash");
    ctx.setActiveTools(active);
  }
});
```

### 4. State Persistence với appendEntry

```typescript
// Lưu state vào session (không gửi LLM)
ctx.appendEntry("my-extension-state", {
  timestamp: Date.now(),
  data: myData
});

// Đọc state trong tool
const entries = await ctx.sessionManager.getEntries("my-extension-state");
const lastState = entries[entries.length - 1]?.data;
```

### 5. Background Processing

Nếu cần chạy background task (không block agent), dùng `setTimeout` hoặc spawn worker:

```typescript
api.on("agent_end", (ctx) => {
  // Non-blocking
  setTimeout(async () => {
    await doBackgroundWork(ctx);
  }, 0);
});
```

### 6. Cleanup

Nếu tạo resource (interval, connection), clean up khi session shutdown:

```typescript
let timer: NodeJS.Timeout;

api.on("session_start", () => {
  timer = setInterval(() => {}, 1000);
});

api.on("session_shutdown", () => {
  if (timer) clearInterval(timer);
});
```

---

## References

- **Type definitions:** `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts`
- **Extension loader:** `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/loader.js`
- **Built-in extensions:** `src/extensions/` trong code piclaw
- **Pi docs:** `/home/quangtynu/Qcoder/qclaw/node_modules/@mariozechner/pi-coding-agent/docs/`

---

**Version:** Built for pi-coding-agent (check package.json for exact version).

**Last updated:** 2026-05-08
