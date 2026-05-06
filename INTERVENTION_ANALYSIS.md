
# 📊 Comprehensive System Analysis
## All Intervention Methods into Piclaw System

Detailed analysis of all methods to extend, customize, and intervene in the Piclaw system (built on `@mariozechner/pi-coding-agent`).

---

## 🎯 SYSTEM ARCHITECTURE OVERVIEW

Piclaw is an AI Coding Agent CLI using a **Dual Dependency Model**:
- **Runtime**: `@mariozechner/pi-coding-agent` (npm package, executed)
- **Reasoning**: `llm-context/` (source code for analysis only, never imported at runtime)

The system follows **"Extensibility First"** design - everything can be extended without forking or modifying core.

---

## 🔧 INTERVENTION METHODS

### 1. EXTENSION SYSTEM (Core Extension Mechanism)

**Name**: Extension System / `ExtensionAPI`

**Description**: The most powerful way to deeply intervene in every processing flow. Extensions can:
- Observe and react to all events
- Register new tools (LLM-callable)
- Add slash commands
- Register keyboard shortcuts
- Modify UI (header, footer, widgets, custom editors)
- Intercept/block webhooks before LLM requests

**Implementation**:

```typescript
// File: ~/.piclaw/agent/extensions/my-extension.ts
export default function (api: ExtensionAPI) {
  // Register new tool
  api.registerTool({
    name: "my_tool",
    label: "My Custom Tool",
    description: "Does something amazing",
    parameters: { /* TypeBox schema */ },
    execute: async (toolCallId, params, signal, onUpdate, ctx) => {
      return {
        content: [{ type: "text", text: "Done!" }],
        details: { /* metadata */ },
        isError: false,
      };
    },
  });

  // Listen to LLM streaming
  api.on("message_update", (event, ctx) => {
    console.log("LLM typing:", event.message.content);
  });

  // Intercept before sending to provider
  api.on("before_provider_request", (event, ctx) => {
    event.payload = { ...event.payload, custom_field: "modified" };
    return event.payload;
  });

  // Add custom command
  api.registerCommand("my-command", {
    description: "Run my custom command",
    getArgumentCompletions: (argumentPrefix) => [{ label: "option1" }],
    handler: async (args, ctx) => {
      await ctx.sendMessage({
        customType: "my-message",
        content: "Command executed!",
      });
    },
  });

  // Register keyboard shortcut
  api.registerShortcut("ctrl+shift+m", {
    description: "Open my menu",
    handler: async (ctx) => {
      ui.notify("Menu opened!");
    },
  });

  // Modify UI
  api.ui.setWidget("my-widget", ["Status: Online"], { placement: "aboveEditor" });
  
  api.ui.setFooter((tui, theme, footerData) => {
    return new MyFooterComponent(tui, theme);
  });
}
```

**Available Events** (via `api.on()`):
- **Session Events**: `session_start`, `session_tree`, `session_before_switch`, `session_before_fork`, `session_compact`, `session_shutdown`
- **Agent Events**: `before_agent_start`, `agent_start`, `agent_end`, `turn_start`, `turn_end`
- **Message Events**: `message_start`, `message_update`, `message_end`
- **Tool Events**: `tool_execution_start`, `tool_execution_update`, `tool_execution_end`
- **Tool Call Events**: `tool_call` (intercept before execution)
- **Tool Result Events**: `tool_result` (intercept/modify after execution)
- **Model Events**: `model_select`
- **Context Events**: `context` (modify messages before LLM)
- **Provider Events**: `before_provider_request`, `after_provider_response`
- **User Events**: `user_bash`, `input`
- **Resource Events**: `resources_discover`

**How to Activate**:
- Place `.ts` or `.js` file in `~/.piclaw/agent/extensions/`
- Or place in `.piclaw/extensions/` (project-level)
- Or install via npm/git: `pi install <package>`
- Extensions auto-load when Piclaw starts

**Advantages**:
- ✅ Deepest intervention into all flows
- ✅ No need to rebuild core
- ✅ TypeScript support, hot-reload
- ✅ Shareable via npm/git (Pi Packages)
- ✅ Access to all services (ModelRegistry, SessionManager, EventBus)

**Disadvantages**:
- ⚠️ Requires TypeScript knowledge
- ⚠️ Extensions run with full system permissions (security risk)

---

### 2. SKILLS SYSTEM (Workflows)

**Name**: Skills / Skills System

**Description**: Define repeatable workflows/tasks as markdown. LLM automatically recognizes and suggests when appropriate.

**Implementation**:

Create `~/.pi/agent/skills/my-skill/SKILL.md`:

```markdown
# Deploy to Production

Use this skill when user requests production deployment.

## Steps
1. Run tests: `npm test`
2. Build: `npm run build`
3. Deploy: `./deploy.sh production`
4. Verify: Check logs at `/var/log/app.log`

## Notes
- Always backup before deploying
- Notify team on Slack after deploy
```

Or define inline via Extension API:

```typescript
api.on("resources_discover", (event, ctx) => {
  return {
    skillPaths: ["/path/to/my/skills"],
  };
});
```

**Usage**:
- User types: `/skill:deploy`
- Or LLM auto-suggests when context matches
- Skill injected into system prompt as instruction

**Advantages**:
- ✅ Easy to write (just markdown)
- ✅ LLM decides when to use
- ✅ Supports parameters (`{{variable}}` replacement)
- ✅ Easy maintenance, shareable

**Disadvantages**:
- ⚠️ Cannot execute code directly (instruction only)
- ⚠️ Depends on LLM understanding

---

### 3. PROMPT TEMPLATES (Command Templates)

**Name**: Prompt Templates / `.pi/prompts/`

**Description**: Frequently used prompts saved as files, invoked quickly via `/name`.

**Implementation**:

Create `~/.pi/agent/prompts/review.md`:

```markdown
# Code Review Template

Review this code for:
1. Security vulnerabilities
2. Performance issues  
3. Code quality (clean code, SOLID)
4. Test coverage

## Context
{{context}}

## Focus on: {{focus_area}}
```

**Usage**:
- In editor, type `/review` → prompt auto-expands
- Or `/review Focus on: performance`

**Supports parameters**: `{{variable}}` replaced at runtime

**Advantages**:
- ✅ Very fast, no re-typing
- ✅ Easy to share (commit to git)
- ✅ Dynamic params support
- ✅ No coding needed

**Disadvantages**:
- ⚠️ Editor-only
- ⚠️ No auto-execution

---

### 4. CUSTOM TOOLS (User-Defined Tools)

**Name**: Custom Tools / `ToolDefinition`

**Description**: Register functions that LLM can call directly (like `read`, `bash`, `edit` but user-defined).

**Implementation**:

**Method 1: Via Extension (recommended)**

```typescript
api.registerTool({
  name: "search_database",
  label: "Search Database",
  description: "Query the production database",
  parameters: {
    // TypeBox schema
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number", default: 10 },
    },
    required: ["query"],
  },
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    const result = await db.query(params.query);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      details: { rowCount: result.length },
      isError: false,
    };
  },
});
```

**Method 2: Via Piclaw config (boot time)**

File `src/piclaw-core.ts`:

```typescript
export async function bootPiclaw(options: PiclawCoreOptions) {
  // ...
  const sessionResult = await createAgentSessionFromServices({
    services,
    sessionManager,
    customTools: [
      createCustomTool1(),
      createCustomTool2(),
    ],
  });
}
```

**Method 3: SubTool Loader** (add to 50+ existing tools)

```typescript
// File tools/sub-tools/my-tool.ts
export async function myTool(cwd: string, args: any) {
  return {
    stdout: "Result",
    stderr: "",
    code: 0,
  };
}
```

Then add to `tools/sub-tools/index.ts` → auto-appears in `subtool_loader`

**Advantages**:
- ✅ LLM calls directly like built-in tools
- ✅ Can return structured data, handle errors
- ✅ Supports streaming (onUpdate callback)
- ✅ UI integration (renderCall/renderResult)

**Disadvantages**:
- ⚠️ Requires TypeScript
- ⚠️ Must define TypeBox schema

---

### 5. PROVIDER SYSTEM (LLM Sources)

**Name**: Provider System / Custom Providers

**Description**: Register new LLM API providers (OpenAI-compatible, Anthropic-compatible, or custom).

**Implementation**:

**Method 1: Via Extension** (dynamic, no restart)

```typescript
api.registerProvider("my-ai", {
  baseUrl: "https://api.my-ai.com/v1",
  apiKey: "MY_AI_API_KEY", // Env var name
  api: "openai-chat-completions", // or "anthropic-messages"
  models: [
    {
      id: "my-model-v1",
      name: "My AI Model",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 16384,
      maxTokens: 8192,
    },
  ],
});
```

**Method 2: Via `models.json`** (static config)

File `~/.piclaw/agent/models.json`:

```json
{
  "providers": {
    "custom-ai": {
      "baseUrl": "https://api.custom.com",
      "apiKey": "API_KEY_ENV_NAME",
      "api": "openai-chat-completions",
      "models": [
        {
          "id": "fast-model",
          "name": "Fast Model",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0.1, "output": 0.3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 8192,
          "maxTokens": 4096
        }
      ]
    }
  }
}
```

**Method 3: OAuth Provider** (SSO login flow)

```typescript
api.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      // Open browser, get token
      return { access: "token", refresh: "token" };
    },
    async refreshToken(credentials) {
      // Refresh expired token
      return newCreds;
    },
    getApiKey(credentials) {
      return credentials.access;
    },
  },
});
```

**Advantages**:
- ✅ Supports any API format (OpenAI, Anthropic, custom)
- ✅ OAuth/SSO support
- ✅ Dynamic model list updates
- ✅ No core modification needed

**Disadvantages**:
- ⚠️ API must be compatible (chat completions or messages format)

---

### 6. SLASH COMMANDS (Slash Commands)

**Name**: Slash Commands System

**Description**: Register new commands shown when user types `/` in editor.

**Implementation**:

Only via Extension:

```typescript
api.registerCommand("translate", {
  description: "Translate text to another language",
  getArgumentCompletions: (prefix) => {
    // Suggest while typing
    return [
      { label: "en (English)" },
      { label: "vi (Vietnamese)" },
      { label: "ja (Japanese)" },
    ];
  },
  handler: async (args, ctx) => {
    // args is string after command name, e.g., "en Hello world"
    await ctx.sendMessage({
      customType: "translation",
      content: `Translating to ${args}...`,
    });
  },
});
```

**Usage**:
1. User types `/translate en Hello` in editor
2. Handler receives `args = "en Hello"`
3. Handler does something (usually `ctx.sendMessage()` or `ctx.sendUserMessage()`)

**Advantages**:
- ✅ Instant in editor
- ✅ Autocomplete support
- ✅ Interact with session (send message, read context)

**Disadvantages**:
- ⚠️ Editor-only
- ⚠️ Must use Extension
- ⚠️ Cannot override built-in commands

---

### 7. AUTOCOMPLETE PROVIDER (Editor Suggestions)

**Name**: Autocomplete Provider

**Description**: Customize suggestions when typing `@` (file references) or in editor.

**Implementation**:

```typescript
api.ui.addAutocompleteProvider((currentProvider) => {
  return {
    ...currentProvider,
    // Override or wrap methods
    getSuggestions: async (context) => {
      const defaultSugs = await currentProvider.getSuggestions?.(context);
      // Add custom suggestions
      return [
        ...defaultSugs,
        { label: "@my-custom-ref", type: "custom" },
      ];
    },
  };
});
```

**Advantages**:
- ✅ Improves editor UX
- ✅ File/project integration

**Disadvantages**:
- ⚠️ Hard to debug
- ⚠️ Limited: only text suggestions, no complex logic

---

### 8. CUSTOM CLI COMMAND (CLI Arguments)

**Name**: CLI Commands / `Command` pattern

**Description**: Add new CLI arguments (`piclaw --my-flag`).

**Implementation**:

Edit `src/cli/args.ts`:

```typescript
export interface Options {
  // ... existing
  myFlag?: boolean;
}

export function parseOptions(args: string[]): { opts: Options; cliOverrides: PiclawConfig } {
  // ...
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--my-flag") {
      opts.myFlag = true;
      cliOverrides.myFlag = true;
    }
  }
  // ...
}
```

Then use in `src/main.ts` or `src/piclaw-core.ts`:

```typescript
if (opts.myFlag) {
  // Do something
}
```

**Advantages**:
- ✅ CLI control
- ✅ Pass config down

**Disadvantages**:
- ⚠️ Must modify core, rebuild
- ⚠️ Less flexible than Extension

---

### 9. THEME SYSTEM (Terminal UI)

**Name**: Theme System

**Description**: Customize TUI colors, icons, borders.

**Implementation**:

Create `~/.pi/agent/themes/my-theme.json`:

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

Or via Extension:

```typescript
api.ui.setTheme({
  name: "my-theme",
  colors: {
    background: "#1a1a2e",
    foreground: "#e6e6e6",
    // ...
  },
});
```

**Advantages**:
- ✅ Easy to change
- ✅ Hot-reload (edit file → auto-update)
- ✅ Customize all colors

**Disadvantages**:
- ⚠️ Only changes colors, not layout

---

### 10. SETTINGS MANAGER (Configuration)

**Name**: Settings System / `~/.piclaw/config.json`

**Description**: Global configuration via JSON file.

**Implementation**:

File `~/.piclaw/config.json`:

```json
{
  "model": "anthropic:claude-opus-4-5",
  "thinking": "high",
  "tools": ["read", "bash", "edit", "write", "subtool_loader", "todos"],
  "verbose": false,
  "contextLogFile": "/path/to/context.log"
}
```

**Read/Write via API**:

```typescript
import { loadConfig, saveConfig } from "@/config/config-manager";

const config = loadConfig({});
config.model = "openai:gpt-4o";
saveConfig(config);
```

**Advantages**:
- ✅ Easy to use
- ✅ Global scope
- ✅ Overridable by CLI

**Disadvantages**:
- ⚠️ Only configures existing features, doesn't add new ones

---

### 11. CONTEXT FILES (AGENTS.MD / SYSTEM PROMPT)

**Name**: Context Files / System Prompt

**Description**: Inject system prompt (instructions) into every conversation.

**Implementation**:

File `~/.pi/agent/AGENTS.md`:

```markdown
# Coding Guidelines

- Always write tests before code
- Use TypeScript strict mode
- Format code with prettier
- Comment clearly
```

File `~/.pi/agent/SYSTEM.md` (fully replaces system prompt):

```markdown
You are a professional developer at Google. Please follow...
```

Or `APPEND_SYSTEM.md` (appends to system prompt):

```markdown
## Additional Rules
- No `console.log`
- Always use type annotations
```

**Advantages**:
- ✅ Affects every session
- ✅ No coding needed
- ✅ LLM always follows

**Disadvantages**:
- ⚠️ No dynamic logic
- ⚠️ Only affects system prompt, cannot block behavior

---

### 12. CONFIG PLUGIN (Extension Auto-Register)

**Name**: Extension Auto-Registration

**Description**: Piclaw auto-registers extension from local file.

**How it Works**:

File `src/helpers.ts` → checks and writes `settings.json`:

```typescript
await ensurePiclawExtensionRegistered(agentDir, extensionPath);
```

File `~/.piclaw/agent/settings.json`:

```json
{
  "extensions": [
    "/path/to/extension.js",
    "/path/to/another-extension.ts"
  ]
}
```

**Advantages**:
- ✅ Auto-loads
- ✅ No complex setup

**Disadvantages**:
- ⚠️ Must write settings file
- ⚠️ Only for extensions, not other components

---

### 13. SESSION HOOKS (Session Lifecycle)

**Name**: Session Event Hooks

**Description**: Intercept/modify at session lifecycle checkpoints.

**Implementation**:

```typescript
api.on("session_before_switch", (event, ctx) => {
  // Block session switch
  if (hasUnsavedWork) {
    return { cancel: true };
  }
});

api.on("session_tree", (event, ctx) => {
  // After navigate tree
  ctx.ui.notify(`Switched to ${event.newLeafId}`);
});

api.on("session_before_compact", (event, ctx) => {
  // Customize compaction
  event.customInstructions = "Keep import statements";
});
```

**Advantages**:
- ✅ Block/modify behavior
- ✅ Can cancel event

**Disadvantages**:
- ⚠️ Must use Extension
- ⚠️ Only available events

---

### 14. CUSTOM MESSAGE TYPE (Custom Chat Messages)

**Name**: Custom Message Renderer

**Description**: Display custom messages in chat (e.g., tables, code, notifications).

**Implementation**:

```typescript
api.registerMessageRenderer("my-table-type", (message, options, theme) => {
  const data = message.content as any[][];
  return new TableComponent(theme, data);
});

// Send message
api.sendMessage({
  customType: "my-table-type",
  content: [["Name", "Age"], ["Alice", 30]],
  display: "Table generated",
  details: { rows: 2 },
});
```

**Advantages**:
- ✅ Rich display
- ✅ UI integration

**Disadvantages**:
- ⚠️ Must code component
- ⚠️ Chat display only

---

### 15. FILE SYSTEM TOOLS (SubTool Loader)

**Name**: SubTool Loader / Unified Tool System

**Description**: Run 50+ system commands via `subtool_loader` tool.

**Implementation**:

LLM calls:

```json
{
  "subtool": "git",
  "args": { "command": "status" }
}
```

Or add new tool:

File `src/tools/sub-tools/my-tool.ts`:

```typescript
export async function myTool(cwd: string, args: any) {
  return {
    stdout: "...",
    stderr: "",
    code: 0,
  };
}
```

**Advantages**:
- ✅ Simple (just a function)
- ✅ LLM calls directly
- ✅ No complex schema

**Disadvantages**:
- ⚠️ Command-line tools only
- ⚠️ Must add to index

---

## 📊 INTERVENTION METHODS SUMMARY TABLE

| # | Method | Scope | Difficulty | Code Required | Power | Best For |
|---|--------|-------|------------|---------------|-------|----------|
| 1 | Extension | Entire system | High | TypeScript | ⭐⭐⭐⭐⭐ | Everything |
| 2 | Skill | Workflow | Low | Markdown | ⭐⭐ | LLM auto-use |
| 3 | Prompt Template | Prompt | Low | Markdown | ⭐⭐ | Quick prompts |
| 4 | Custom Tool | LLM tools | Medium | TS + Schema | ⭐⭐⭐⭐ | LLM calls |
| 5 | Provider | LLM source | Medium | TS/JSON | ⭐⭐⭐⭐ | Change LLM |
| 6 | Slash Command | `/` commands | Medium | TypeScript | ⭐⭐⭐ | Interaction |
| 7 | Autocomplete | Suggestions | Low | TypeScript | ⭐ | Editor UX |
| 8 | CLI Command | CLI args | Low | TypeScript | ⭐⭐ | Startup |
| 9 | Theme | UI | Low | JSON/TS | ⭐ | Visuals |
| 10 | Settings | Config | Low | JSON | ⭐ | Configuration |
| 11 | Context File | System Prompt | Low | Markdown | ⭐⭐ | Static prompt |
| 12 | Config Plugin | Auto-load | Low | JSON | ⭐⭐ | Manage ext |
| 13 | Session Hook | Lifecycle | Medium | TypeScript | ⭐⭐⭐ | Control flow |
| 14 | Custom Message | Chat UI | Medium | TS + UI | ⭐⭐ | Display |
| 15 | SubTool | Commands | Low | Simple TS | ⭐⭐⭐ | Run commands |

---

## 🎯 RECOMMENDATIONS: WHICH METHOD TO USE?

### 1. Want to add new capability LLM can use (e.g., read DB, call API, deploy)?
→ **Use Custom Tool** or **Extension** (if complex)

### 2. Want LLM to auto-perform task when context matches?
→ **Use Skill** (if workflow) or **Extension + Event** (if needs execution)

### 3. Want to control tools/models/config via settings?
→ **Use Settings** (local) or **Extension + Command** (if need UI)

### 4. Want to change LLM source (use internal API, different provider)?
→ **Use Provider** (via Extension or models.json)

### 5. Want to intercept before LLM receives prompt?
→ **Use Extension + Event "context"** or **AGENTS.md/SYSTEM.md**

### 6. Want to block LLM from using certain tool or modify arguments?
→ **Use Extension + Event "tool_call"**

### 7. Want to modify tool results after LLM runs?
→ **Use Extension + Event "tool_result"**

### 8. Want quick command for team to use?
→ **Use Slash Command** (via Extension)

### 9. Want to log/audit all actions?
→ **Use Extension + Events "tool_execution_start/end"**

### 10. Want to intercept session switch/tree/fork?
→ **Use Extension + Session Events**

### 11. Want to change UI appearance (colors, theme)?
→ **Use Theme** or **Extension + UI API**

### 12. Want to add on-screen component (status bar, widget)?
→ **Use Extension + UI API (setWidget, setFooter, setHeader)**

---

## 🔐 SECURITY NOTES

High-level intervention methods (**Extension, Custom Tool, Provider**) have permissions to:
- Run shell commands (if configured)
- Read/write files
- Network access (HTTP calls)
- Change settings
- Log in/out

**Always**:
- Review extension code before installing
- Don't install untrusted extensions
- Use `allowDangerousTools: false` if not needed
- Check `disabledTools` in SubTool Loader

---

## 📝 CONCLUSION

Piclaw provides **15+ intervention methods** at different depths:

- **Lightweight** (Markdown/JSON): Skill, Prompt Template, Theme, Settings, Context Files
- **Medium** (Simple TypeScript): CLI Command, SubTool, Autocomplete, Custom Message
- **Deep** (Complex TypeScript): Extension, Custom Tool, Provider, Slash Command, Session Hooks

**Extension** is the most powerful - can do anything but requires coding.
**Skill/Template** is easiest - just markdown, guides LLM.

System is designed to be open - **no core fork needed** for customization. Everything is pluggable.

---

*Document written based on source code analysis of Piclaw (`/home/quangtynu/Qcoder/qclaw`) and `llm-context/packages/coding-agent`*

