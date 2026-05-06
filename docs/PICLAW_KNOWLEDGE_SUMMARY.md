# Piclaw Knowledge Summary

## Mission & Goals

Build **Piclaw** thành **production-grade AI coding agent** với đầy đủ tính năng:
- TUI (terminal UI) chuyên nghiệp, mượt mà
- Memory & session management với branching
- Multi-provider LLM support (268+ models)
- Extensible architecture
- SubTool Loader (50+ system operations)
- Security, testing, performance optimization

---

## Core Architecture

### Dual Dependency Model (BẮT BUỘC)

```
├─ node_modules/           ← Runtime (execution)
│   └─ @mariozechner/pi-coding-agent (npm package)
├─ llm-context/            ← Reasoning (chỉ đọc, KHÔNG import)
│   └─ packages/coding-agent/ (source code cho LLM phân tích)
└─ src/                    ← Application code của bạn
```

**Nguyên tắc:**
- `npm = RUN` - Dùng package từ npm để chạy
- `llm-context = UNDERSTAND` - Clone source code để LLM đọc và hiểu

**Tuyệt đối KHÔNG:**
- ❌ Import từ `llm-context/`
- ❌ Build từ `llm-context/`
- ❌ Reimplement functionality có sẵn

---

### Kiến Trúc Lớp

**pi-agent-core** (framework tổng quát) → **pi-coding-agent** (app CLI chuyên dụng)

```
pi-agent-core
    ↓
    └── pi-coding-agent

Giống: React (framework) → Next.js (ứng dụng)
```

Coding-agent **không kế thừa** mà **tạo instance** và **inject** custom config:
- `convertToLlm` - chuyển internal messages → LLM format
- `streamFn` - gọi LLM API với auth, retry, timeout
- `transformContext` - extensions sửa messages trước khi gửi

---

## Các Phương Pháp Can Thiệp Hệ Thống (15+)

| # | Tên | Độ Khó | Dùng Khi | Phạm Vi |
|---|-----|---------|----------|---------|
| 1 | Extension | Cao | Mọi thứ | Toàn hệ thống |
| 2 | Custom Tool | Trung | LLM gọi trực tiếp | Tools |
| 3 | Slash Command | Trung | Lệnh `/` tương tác | Editor |
| 4 | Provider | Trung | Thêm LLM mới | Models |
| 5 | SubTool | Thấp | System commands | Bash ops |
| 6 | Skills | Thấp | Workflow tự động | LLM guidance |
| 7 | Prompt Templates | Thấp | Expand nhanh | Editor |
| 8 | Context Files | Thấp | Custom rules | System prompt |
| 9 | Settings | Thấp | Cấu hình tĩnh | Global config |
| 10 | Theme | Thấp | Giao diện | Colors |
| 11 | CLI Commands | Thấp | Startup flags | Launch |
| 12 | Session Hooks | Trung | Lifecycle control | Session events |
| 13 | Custom Message Renderer | Trung | UI components | Chat display |
| 14 | Autocomplete Provider | Thấp | Editor UX | Suggestions |
| 15 | Config Plugin | Thấp | Auto-load extensions | Settings |

**👉 Extension là MẠNH NHẤT** - có thể làm mọi thứ, listen tất cả events, modify UI, register tools/commands/providers.

---

## Extension System Chi Tiết

### Cấu Trúc Extension

```typescript
// File: ~/.piclaw/agent/extensions/my-extension.ts
export default function (api: ExtensionAPI) {
  // Đăng ký tool
  api.registerTool({
    name: "tool_name",
    label: "Human Label",
    description: "What it does",
    parameters: { type: "object", properties: {...} },
    execute: async (id, params, signal, onUpdate, ctx) => {
      return {
        content: [{ type: "text", text: "result" }],
        details: { metadata: "..." },
        isError: false,
      };
    },
  });

  // Đăng ký slash command
  api.registerCommand("cmd", {
    description: "Command description",
    getArgumentCompletions: (prefix) => [{ label: "opt" }],
    handler: async (args, ctx) => {
      await ctx.sendMessage({ content: "done" });
    },
  });

  // Listen events (25+ types)
  api.on("tool_execution_start", (event, ctx) => {
    console.log(`Start: ${event.toolName}`);
  });

  // Modify UI
  api.ui.setWidget("status", ["Online"], { placement: "aboveEditor" });
  api.ui.notify("Message", "info");

  // Register provider
  api.registerProvider("my-ai", {
    baseUrl: "https://api.com",
    apiKey: "ENV_VAR",
    api: "openai-chat-completions",
    models: [...],
  });
}
```

### Các Event Có thể Listen

**Session Events:**
- `session_start`, `session_tree`, `session_before_switch`
- `session_before_fork`, `session_before_compact`, `session_compact`
- `session_shutdown`

**Agent Events:**
- `before_agent_start`, `agent_start`, `agent_end`
- `turn_start`, `turn_end`

**Message Events:**
- `message_start`, `message_update`, `message_end`

**Tool Events:**
- `tool_call` (chặn trước khi execute)
- `tool_result` (sửa kết quả sau execute)
- `tool_execution_start`, `tool_execution_update`, `tool_execution_end`

**Model Events:**
- `model_select`

**Context Events:**
- `context` (sửa messages trước LLM)
- `before_provider_request`, `after_provider_response`

**User Events:**
- `input`, `user_bash`

**Resource Events:**
- `resources_discover`

### Extension Context Methods

```typescript
// Base context (event handlers)
ctx.isIdle()
ctx.abort()
ctx.hasPendingMessages()
ctx.getContextUsage()
ctx.compact(options)
ctx.getSystemPrompt()
ctx.shutdown()

// Command context (slash commands)
ctx.waitForIdle()
ctx.newSession(options)
ctx.fork(entryId, options)
ctx.navigateTree(entryId, options)
ctx.switchSession(path, options)
ctx.reload()
ctx.sendMessage(message)
ctx.sendUserMessage(text)
ctx.exec(command, args) // Run subtool
```

### UI Methods

```typescript
api.ui.notify(message, type)
api.ui.setStatus(key, text)
api.ui.setWidget(key, lines, options)
api.ui.setFooter(factory)
api.ui.setHeader(factory)
api.ui.setEditorComponent(factory)
api.ui.select(title, options)
api.ui.confirm(title, message)
api.ui.input(title, placeholder)
api.ui.addAutocompleteProvider(wrapper)
api.ui.setTheme(theme)
```

### Kích Hoạt Extension

- **Local file:** `~/.piclaw/agent/extensions/*.ts` (auto-load)
- **NPM package:** `pi install npm:package-name`
- **Git repo:** `pi install git:github.com/user/repo`
- **Local path:** `pi install /path/to/extension`

---

## SubTool Loader (50+ Tools)

**Single tool** thực thi nhiều command:

**Categories:**
- **Version Control:** git
- **Containers:** docker, k8s
- **Cloud:** aws, terraform
- **Databases:** db, kafka, redis
- **Package Managers:** npm, apt, yum
- **Systemd:** systemctl, journalctl
- **Processes:** ps, kill, crontab
- **System Info:** df, du, free, iostat, netstat, ss
- **Network:** ping, traceroute, nslookup, dig, wget
- **File Ops:** tail, scp, rsync
- **Data Processing:** jq, yq, xmllint
- **Media:** ffmpeg
- **Security:** ufw, ssh
- **Utilities:** update, backup, password, weather, time, at, quota, iso
- **Computer Use:** bash, ls, find, grep, read

**Usage:**

```json
{
  "subtool": "git",
  "args": { "command": "status" }
}

{
  "subtool": "docker",
  "args": { "command": "ps -a", "timeout": 30 }
}

{
  "subtool": "bash",
  "args": { "command": "npm test", "cwd": "/path", "timeout": 300 }
}
```

**Thêm custom sub-tool:**
- Tạo file `src/tools/sub-tools/my-tool.ts`
- Export function `myTool(cwd, args)`
- Thêm vào `src/tools/sub-tools/index.ts`
- Rebuild

**Security:** Có thể disable dangerous tools qua config.

---

## TUI Architecture (pi-tui)

### Component Hierarchy

```
TUI (root)
└── Panel (vertical)
    ├── StatusBarComponent       [Model, Branch, Status]
    ├── AssistantMessageComponent  [Chat history]
    │   ├── UserMessageComponent
    │   ├── AssistantMessageComponent
    │   ├── ToolExecutionComponent
    │   └── CustomMessageComponent
    └── UserMessageSelectorComponent [Input editor]
```

### Data Flow

```
1. User nhập lệnh
   ↓
2. UserMessageComponent gửi xuống AgentSession
   ↓
3. AgentSession gọi runAgentLoop() từ core
   ↓
4. Core stream LLM qua streamFn
   ↓
5. Nhận tokens từng chunk → emit 'message_update'
   ↓
6. AgentSession emit event lên TUI
   ↓
7. AssistantMessageComponent.streamUpdate()
   ↓
8. TUI.requestRender() → Differential render
   ↓
9. Chỉ update phần thay đổi (không full redraw)
```

### Performance

- **Differential rendering:** Chỉ gửi diff xuống terminal
- **No flicker:** Không nhấp nháy
- **Real-time streaming:** Token hiện ngay
- **Optimized I/O:** Minimal terminal writes

---

## Session Management

### Tree Structure

```
Start
  ├─> Implement v1
  │     ├─> Fix bug A
  │     └─> Optimize
  └─> Implement v2
        └─> Refactor
```

### Commands

- `/new` - Fresh session
- `/resume` - Browse past sessions
- `/tree` - Navigate tree (view all branches)
- `/fork` - Create new branch tại current point
- `/clone` - Duplicate current branch
- `/compact` - Summarize old messages
- `/export [file]` - Save to HTML/JSON
- `/import [file] - Resume from file`

### Features

- **Branching:** Thử nghiệm nhiều hướng
- **Merging:** Combine best parts
- **Labeling:** Đánh dấu important nodes
- **Compaction:** Tự động hoặc manual summarize
- **Persistence:**Saved to `~/.piclaw/sessions/`
- **Context window:** Management để tránh overflow

---

## Tools System

### Built-in Tools (from pi-coding-agent)

- `bash` - Execute shell commands
- `read` - Read file contents (with truncation)
- `write` - Write to file
- `edit` - Edit file (search/replace)
- `find` - Find files by pattern
- `grep` - Search file contents
- `ls` - List directory

### Tool Definition Interface

```typescript
{
  name: string;
  label: string;
  description: string;
  parameters: TypeBoxSchema;  // JSON Schema
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    return {
      content: [{ type: "text", text: "result" }],
      details: { metadata: "..." },
      isError: boolean;
    };
  };
  executionMode: "sequential" | "parallel";
}
```

### Truncation

Read/edit có truncation:
- Default: 1000 lines, 100KB
- Configurable qua options
- Head/tail truncation với indicators

---

## Context Files (System Prompt Customization)

**Location (auto-discovered, priority order):**
1. `~/.pi/agent/` (global)
2. `.pi/` (project)
3. Parent directories (walk up tree)

**File Types:**

- **`AGENTS.md`** - Coding guidelines, rules (append to system prompt)
  ```markdown
  # Rules
  - Write tests first
  - Use TypeScript strict
  - Follow SOLID
  ```

- **`SYSTEM.md`** - Complete override system prompt
  ```markdown
  You are a senior engineer at Google...
  ```

- **`APPEND_SYSTEM.md`** - Append rules to existing prompt
  ```markdown
  ## Additional
  - No console.log
  - Always type annotations
  ```

**Merging:** All files found concatenated, last takes precedence.

**Disable:** `piclaw --no-context-files` hoặc `"noContextFiles": true` trong config.

---

## Configuration

### Main Config: `~/.piclaw/config.json`

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

### Settings: `~/.piclaw/agent/settings.json`

```json
{
  "extensions": ["/path/to/ext.ts"],
  "imageDisplay": "auto",
  "theme": "default",
  "allowDangerousTools": true,
  "disabledTools": [],
  "skillPaths": [],
  "promptPaths": []
}
```

### Auth: `~/.piclaw/auth.json` (auto-generated)

```json
{
  "anthropic": "sk-ant-...",
  "openai": "sk-..."
}
```

### Override với CLI

```bash
piclaw --model openai:gpt-4o --thinking high --verbose
piclaw --cwd /path --tools read,bash,edit
```

---

## Slash Commands

### Built-in (from pi-core)

- `/model` - Select model (UI)
- `/thinking` - Change thinking level
- `/settings` - Settings panel
- `/session` - Session info
- `/tree` - Tree navigator
- `/new` - New session
- `/resume` - Resume session
- `/fork` - Fork branch
- `/clone` - Clone branch
- `/compact` - Summarize context
- `/export` - Export session
- `/import` - Import session
- `/hotkeys` - Show shortcuts
- `/changelog` - Recent changes
- `/quit` - Exit

### Piclaw-specific

- `/config` - Show current config
- `/piclaw-set <key> <value>` - Set config key
- `/tools` - List active tools
- `/piclaw-status` - Show Piclaw status

**Custom commands** đăng ký qua Extension.

---

## Keyboard Shortcuts

- `Ctrl+C` - Clear editor (once), Quit (twice)
- `Escape` - Cancel/abort
- `Ctrl+P` - Model selector
- `Ctrl+L` - Thinking level toggle
- `Shift+Tab` - Cycle thinking
- `Alt+Enter` - Queue message
- `Ctrl+O` - Toggle tool output
- `Ctrl+R` - Regenerate response
- `Ctrl+Q` - Quick quit

---

## CLI Startup Options

```bash
piclaw [options] [prompt]

Options:
  --cwd <path>           Working directory
  --model <id>           Model to use
  --thinking <level>     Thinking: off|minimal|low|medium|high|xhigh
  --tools <list>         Comma-separated allowlist
  --sessionDir <dir>     Custom session storage
  --verbose              Debug logs
  --no-context-files     Disable AGENTS.md, etc.
  --print                Non-interactive print mode
  --mode <mode>          mode: interactive|print|rpc
  --import <file>        Import session on startup
```

---

## Provider System

### Built-in Providers

- Anthropic (Claude)
- OpenAI (GPT, o1)
- Google (Gemini)
- DeepSeek
- Together
- Replicate
- Groq
- 260+ via Kilo provider

### Register Custom Provider (via Extension)

```typescript
api.registerProvider("my-ai", {
  baseUrl: "https://api.my-ai.com/v1",
  apiKey: "MY_AI_API_KEY_ENV",
  api: "openai-chat-completions",  // or "anthropic-messages"
  models: [
    {
      id: "my-model",
      name: "My AI Model",
      reasoning: false,
      input: ["text"],
      cost: { input: 0.1, output: 0.3 },
      contextWindow: 16384,
      maxTokens: 8192,
    },
  ],
  // Optional OAuth
  oauth: {
    name: "My AI (SSO)",
    async login(callbacks) { /* browser flow */ },
    async refreshToken(creds) { /* refresh */ },
    getApiKey(creds) { return creds.access; },
  },
});
```

### Static Config: `~/.piclaw/models.json`

```json
{
  "providers": {
    "custom": {
      "baseUrl": "https://api.com",
      "apiKey": "ENV_VAR",
      "api": "openai-chat-completions",
      "models": [...]
    }
  }
}
```

---

## Skills System

**Markdown files** defining reusable workflows.

**Location:**
- `~/.pi/agent/skills/`
- `.pi/skills/`

**Structure:**

```
skills/
├── deploy/
│   └── DEPLOY.md
├── review/
│   └── REVIEW.md
└── setup/
    └── ONBOARDING.md
```

**Example SKILL.md:**

```markdown
# Deploy to {{environment}}

Use for deploying applications.

## Steps

1. Run tests
   ```bash
   npm test
   ```

2. Build
   ```bash
   npm run build
   ```

3. Deploy to {{environment}}
   ```bash
   ./deploy.sh {{environment}}
   ```

## Notes

- Always backup first!
- Notify team on Slack
- Check logs at /var/log/app.log
```

**Usage:** `/skill:deploy production`

Piclaw replaces `{{variables}}` and guides through steps.

**Auto-suggest:** Piclaw suggests relevant skills based on context.

---

## Prompt Templates

**Markdown files** for quick expansion.

**Location:**
- `~/.pi/agent/prompts/`
- `.pi/prompts/`

**Example template (`review.md`):**

```markdown
# Code Review

Review this code for:
1. Security vulnerabilities
2. Performance issues
3. Code quality
4. Test coverage

## Context
{{context}}

## Focus on: {{focus}}
```

**Usage:** Type `/review` in editor → template expands → fill params → send.

**Variables:** `{{code}}`, `{{file}}`, `{{context}}`, `{{date}}`, `{{user}}`, custom params.

---

## Compaction & Context Management

### Why Compact?

LLM có context window giới hạn (ví dụ 200K tokens). Khi chat dài, cần summarize old messages để giải phóng space.

### How It Works

1. **Detect overflow:** `shouldCompact(contextUsage, settings)`
2. **Find cut point:** `findCutPoint(entries)` - tìm điểm cắt tốt nhất (thường sau turn hoàn chỉnh)
3. **Summarize:** `generateSummary(messages, customInstructions)` - dùng LLM tạo summary
4. **Replace:** Thay thế old messages bằng summary message
5. **Record:** Lưu compaction entry vào session metadata

### Triggers

- **Automatic:** Trước mỗi turn mới, kiểm tra usage
- **Manual:** `/compact` command
- **Custom:** `/compact "Keep only API changes"`

### Compaction Entry

```json
{
  "type": "compaction",
  "timestamp": 1234567890,
  "summary": "Summarized 50 messages to 1",
  "originalCount": 50,
  "compactedCount": 1,
  "tokensFreed": 15000
}
```

### Settings

```json
{
  "compaction": {
    "enabled": true,
    "maxContextTokens": 180000,  // Warning at 90%
    "autoCompact": true,
    "keepLastN": 10,  // Always keep last N turns
    "summarizationModel": "anthropic:claude-3-haiku"
  }
}
```

---

## Authentication & API Keys

### Providers

**Environment Variables:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...
```

**Config File:** `~/.piclaw/auth.json` (auto-generated)
```json
{
  "anthropic": "sk-ant-...",
  "openai": "sk-..."
}
```

**OAuth Flow:** Via `/login` command hoặc Extension OAuth.

**Per-model API keys:** Ghi đè global qua `models.json`.

---

## Session Persistence

### Format

Sessions lưu ở `~/.piclaw/sessions/` dưới dạng JSONL:

```
{"type":"header","version":1,"created":12345,...}
{"type":"message","role":"user","content":"Hello"}
{"type":"message","role":"assistant","content":"Hi!"}
{"type":"tool_call","name":"bash","args":{...}}
{"type":"tool_result","name":"bash","content":"..."}
{"type":"compaction","summary":"...","timestamp":...}
...
```

### Entry Types

- `header` - Metadata (model, thinking, cwd)
- `message` - User/assistant messages
- `tool_call` - Tool invocation
- `tool_result` - Tool result
- `branch_summary` - Branch summarization
- `compaction` - Compaction record
- `model_change` - Model switch
- `thinking_change` - Thinking level change
- `custom` - Custom entries

### Navigation

- `SessionManager` parse JSONL → entries array
- `buildSessionContext()` - rebuild messages từ entries (apply compaction, filters)
- Tree structure từ branching events (`/fork`, `/clone`)

---

## Theme System

**Theme class** quản lý colors, syntax highlighting.

**Location:**
- Built-in: `default`, `dark`, `light`
- User: `~/.pi/agent/themes/my-theme.json`

**Theme JSON:**
```json
{
  "name": "My Theme",
  "colors": {
    "background": "#1a1a2e",
    "foreground": "#e6e6e6",
    "primary": "#00d4aa",
    "secondary": "#ff6b6b",
    "border": "#2d2d44",
    "dim": "#666666",
    "accent": "#ffd93d"
  }
}
```

**Set via Extension:**
```typescript
api.ui.setTheme({ colors: { ... } });
```

**Syntax Highlighting:**
- `highlightCode(code, language)`
- Auto-detect language từ file extension
- Supports: typescript, python, rust, go, bash, json, markdown, etc.

---

## Development Workflow (Autonomous Loop)

```
plan → code → test → evaluate → decide → repeat
```

### Step 1: PLAN

- Đọc code hiện tại trong `/src`
- Xác định feature cần thêm
- Đọc relevant source trong `llm-context/packages/coding-agent/src/`
- Tìm API cần dùng
- Design minimal solution (< 1 day scope)

### Step 2: CODE

- Tạo branch: `git checkout -b feature/<short-name>`
- Import từ npm (`@mariozechner/pi-coding-agent`)
- Không import từ `llm-context/`
- Viết code đơn giản, readable
- Add JSDoc cho public APIs
- Tuân thủ Hard Rules

### Step 3: TEST

- Unit tests cho logic mới (vitest/jest)
- Integration tests nếu cần
- Run: `npm test`
- Type check: `npm run check`
- Build: `npm run build`
- Manual test TUI nếu có UI

### Step 4: EVALUATE

**Checklist:**
- ✅ Chạy đúng?
- ✅ Dùng existing libraries (không rewrite)?
- ✅ UX improved?
- ✅ Safe (no injection, no unsafe eval)?
- ✅ Performance acceptable (<100ms UI)?
- ✅ Tests pass?

### Step 5: DECIDE

**Nếu tốt:**
```bash
git add .
git commit -m "feat: description"
git push origin feature/<name>
# Tạo PR, chờ review
```

**Nếu không:**
```bash
git reset --hard HEAD
# Bắt đầu lại
```

---

## Hard Rules (Non-Negotiable)

### Priority 1: USE EXISTING LIBRARIES

```
@mariozechner/pi-coding-agent   (PRIMARY)
@mariozechner/pi-agent-core     (if needed)
@mariozechner/pi-ai             (if needed)
@mariozechner/pi-tui            (if needed)
```

**Không:**
- ❌ Reimplement functionality có sẵn
- ❌ Viết custom TUI khi đã có pi-tui
- ❌ Dùng readline thay vì pi-tui

**Phải:**
- ✅ Đọc source trong `llm-context/` trước khi dùng
- ✅ Import từ npm, không từ source
- ✅ Biết chính xác API signature trước khi code

### Dual Dependency Rule

```
❌ DO NOT import from llm-context
❌ DO NOT build from llm-context
✔ ONLY import from npm
✔ llm-context is READ-ONLY for understanding
```

### Security

**Không được:**
- Command injection (validate user input)
- Path traversal (sanitize paths)
- Unsafe eval (không eval code)
- Arbitrary execution (limit tool permissions)
- Secret leakage (never log API keys)

**Phải:**
- Validate all inputs (TypeBox schemas)
- Sanitize outputs (escape HTML, etc.)
- Respect file permissions
- Use AbortSignal for cancellation

---

## Performance Targets

- **UI response:** < 100ms (từ input đến render)
- **Memory ops:** < 50ms (session load/save)
- **Rendering:** Differential, no full redraws
- **Re-renders:** Only on actual changes
- **Memory footprint:** Minimal (native cleanup)
- **Startup time:** < 2s

---

## Testing Standards

- **Unit tests** cho mọi logic mới (vitest)
- **Integration tests** cho tool chains
- **E2E tests** cho interactive flows (nếu có)
- **Real scenarios** từ package tests làm examples
- **Avoid flaky async tests** (use proper mocking)
- Run `npm test` trước commit

---

## Extension Publishing

### Package Structure

```
my-extension/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

**package.json:**
```json
{
  "name": "my-piclaw-extension",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "keywords": ["piclaw", "extension"],
  "license": "Apache-2.0",
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "^0.73.0"
  }
}
```

### Workflow

1. Build: `npm run build`
2. Test locally: `npm link`, rồi `pi install my-extension`
3. Bump version: `npm version patch|minor|major`
4. Publish: `npm publish --access public`
5. Git push tags: `git push origin main --tags`

### Users Install

```bash
pi install npm:my-piclaw-extension
pi install git:github.com/user/repo
pi install /path/to/local
```

---

## Community & Support

- **Discord:** https://discord.com/invite/3cU7Bz4UPx
- **GitHub:** https://github.com/badlogic/pi-mono
- **Twitter:** @piclaw_ai
- **Docs:** `/docs/` trong repo

### Contribution Gate

- New contributors: Issues/PRs auto-closed
- Cần `lgtm` từ maintainer để được submit PR
- Weekend issues (Fri-Sun) không được review
- Quality bar: short, concrete, reproducible

### Best Practices

- Read `CONTRIBUTING.md` trước khi contribute
- Run `npm run check && ./test.sh` trước PR
- Don't edit `CHANGELOG.md` (maintainers add)
- Keep issues concise (<1 screen)
- Don't spam with agent-generated issues

---

## Quick Reference: Extension API

### Register Tool

```typescript
api.registerTool({
  name: "tool_name",
  label: "Label",
  description: "Description for LLM",
  parameters: { type: "object", properties: {...} },
  execute: async (id, params, signal, onUpdate, ctx) => {
    // Return { content, details, isError }
  },
});
```

### Register Command

```typescript
api.registerCommand("cmd", {
  description: "What it does",
  getArgumentCompletions: (prefix) => [{ label: "opt" }],
  handler: async (args, ctx) => { /* ... */ },
});
```

### Listen Events

```typescript
api.on("tool_execution_start", (event, ctx) => {});
api.on("tool_execution_end", (event, ctx) => {});
api.on("message_update", (event, ctx) => {});
api.on("before_provider_request", (event, ctx) => {
  event.payload.custom = "value";
  return event.payload; // Modify request
});
```

### UI Methods

```typescript
api.ui.notify("msg", "info" | "success" | "error");
api.ui.setWidget("key", ["line1", "line2"], { placement: "aboveEditor" });
api.ui.setStatus("key", "text");
api.ui.select("Title", ["a", "b"]);
api.ui.confirm("Title", "Message");
```

### Context Actions

```typescript
// In event handlers
ctx.abort();
ctx.getContextUsage();
ctx.compact({ customInstructions: "..." });

// In command handlers
await ctx.waitForIdle();
await ctx.exec("bash", ["command"]);
await ctx.sendMessage({ content: "..." });
```

---

## Key Files in llm-context/packages/coding-agent/src/

**Tìm hiểu implementation:**

- `index.ts` - Tất cả exports (315 declarations)
- `core/agent-session.ts` - Main session class
- `core/sdk.ts` - Programmatic API
- `core/extensions/index.ts` - Extension system (72 types!)
- `core/tools/index.ts` - Tool definitions
- `core/compaction/` - Context management
- `core/model-registry.ts` - Models & providers
- `modes/interactive/` - TUI mode
- `modes/interactive/components/` - UI components
- `main.ts` - CLI entry point

---

## SDK Usage (Programmatic)

```typescript
import {
  createAgentSession,
  createAgentSessionServices,
  createAgentSessionRuntime,
  createBashToolDefinition,
  createReadToolDefinition,
} from "@mariozechner/pi-coding-agent";

const { session, services } = await createAgentSession({
  cwd: process.cwd(),
  model: "anthropic:claude-opus-4-5",
  thinkingLevel: "high",
});

// Use session programmatically
await session.prompt("Help me refactor this code");
```

---

## Important Notes

1. **Never import from llm-context** - chỉ đọc source cho LLM hiểu
2. **All modifications via extension** - không sửa core
3. **Security first** - validate inputs, avoid injection
4. **Performance matters** - differential rendering, minimal re-renders
5. **Test everything** - unit tests, integration tests
6. **Read the source** - trong `llm-context/` trước khi dùng API
7. **Follow AGENTS.md** - autonomous protocol cho coding agents
8. **Extension auto-load** - từ `~/.piclaw/agent/extensions/`
9. **Session tree** - branch/fork/merge for experiments
10. **Context is king** - manage it well với compaction

---

## Conclusion

Piclaw là **full-stack coding agent system** với:

✅ Kiến trúc dual-layer (npm + source)
✅ 15+ điểm can thiệp (extension là mạnh nhất)
✅ TUI mượt với differential rendering
✅ Session tree với branching/compaction
✅ 268+ models qua multi-provider
✅ 50+ system tools qua SubTool Loader
✅ Skills & templates automation
✅ Extensible architecture (không cần fork core)
✅ Production-ready (security, testing, performance)

**Next:** Đọc source trong `llm-context/packages/coding-agent/src/` để hiểu implementation chi tiết, hoặc bắt đầu code extension mới!

---

*Summary compiled from: AGENTS.md, SYSTEM.md, README.md, docs/*.md, llm-context/*.md*
*Date: 2026-05-06*