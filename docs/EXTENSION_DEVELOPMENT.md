# 🛠 Extension Development Workflow

## Overview

Piclaw extensions are TypeScript modules that add custom tools, commands, providers, and UI components to the AI coding agent. This guide walks you through creating, testing, and publishing extensions.

## Quick Start

### 1. Create Your Extension File

Create a TypeScript file in `~/.piclaw/agent/extensions/`:

```bash
mkdir -p ~/.piclaw/agent/extensions
touch ~/.piclaw/agent/extensions/my-extension.ts
```

### 2. Basic Extension Structure

```typescript
// my-extension.ts
export default function (api: ExtensionAPI) {
  // Your extension code here
  console.log("My extension loaded!");
}
```

### 3. Register a Custom Tool

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (api: ExtensionAPI) {
  api.registerTool({
    name: "search_code",
    label: "Search Code",
    description: "Search for code patterns in the project",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", default: "." },
      },
      required: ["pattern"],
    },
    execute: async (toolCallId, params, signal, onUpdate, ctx) => {
      // Run grep via subtool_loader or exec
      const result = await ctx.exec("grep", ["-r", params.pattern, params.path]);
      return {
        content: [{ type: "text", text: result.stdout }],
        details: { matches: result.stdout.split("\n").length },
        isError: false,
      };
    },
  });
}
```

### 4. Register a Slash Command

```typescript
api.registerCommand("deploy", {
  description: "Deploy the application",
  getArgumentCompletions: (prefix) => [
    { label: "staging" },
    { label: "production" },
  ],
  handler: async (args, ctx) => {
    const env = args.trim() || "staging";
    await ctx.sendMessage({
      customType: "deploy-status",
      content: `Deploying to ${env}...`,
    });
    
    // Run deployment
    await ctx.exec("./deploy.sh", [env]);
    
    await ctx.sendMessage({
      customType: "deploy-status",
      content: `✓ Deployed to ${env}`,
    });
  },
});
```

### 5. Listen to Events

```typescript
api.on("tool_execution_start", (event, ctx) => {
  console.log(`Tool starting: ${event.toolName}`);
});

api.on("tool_execution_end", (event, ctx) => {
  console.log(`Tool finished: ${event.toolName}`);
});

api.on("before_provider_request", (event, ctx) => {
  // Modify request payload before LLM call
  event.payload = { ...event.payload, custom_header: "value" };
  return event.payload;
});
```

### 6. Add Custom UI

```typescript
// Add a widget above the editor
api.ui.setWidget("status-widget", ["✓ Ready"], {
  placement: "aboveEditor",
});

// Set custom footer
api.ui.setFooter((tui, theme, footerData) => {
  return new CustomFooterComponent(tui, theme, footerData);
});
```

### 7. Register a Provider

```typescript
api.registerProvider("my-ai", {
  baseUrl: "https://api.my-ai.com/v1",
  apiKey: "MY_AI_API_KEY",
  api: "openai-chat-completions",
  models: [
    {
      id: "my-model",
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

## Development Workflow

### Step 1: Create Extension

```bash
# Create extension directory
mkdir -p ~/.piclaw/agent/extensions

# Create extension file
cat > ~/.piclaw/agent/extensions/my-extension.ts << 'EOF'
export default function (api) {
  api.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      await ctx.sendMessage({
        customType: "hello",
        content: "Hello, World!",
      });
    },
  });
}
EOF
```

### Step 2: Load Extension

The extension auto-loads on Piclaw startup. You can also manually register it in `~/.piclaw/agent/settings.json`:

```json
{
  "extensions": [
    "/home/user/.piclaw/agent/extensions/my-extension.ts"
  ]
}
```

### Step 3: Test Extension

Start Piclaw and try your command:

```bash
piclaw
```

In the editor, type `/hello` and press Enter.

### Step 4: Debug Extension

Add console.log statements and check the terminal output:

```typescript
export default function (api) {
  console.log("Extension loaded!");
  
  api.registerCommand("debug", {
    description: "Debug info",
    handler: async (args, ctx) => {
      console.log("Command executed!", ctx);
      await ctx.sendMessage({
        content: `Model: ${ctx.model?.name}`,
      });
    },
  });
}
```

### Step 5: Reload Extension

After making changes, reload without restarting:

1. In Piclaw, type `/reload`
2. Or restart Piclaw

## Extension API Reference

### Event Handlers

```typescript
// Session events
api.on("session_start", handler);
api.on("session_tree", handler);
api.on("session_before_switch", handler);
api.on("session_before_fork", handler);
api.on("session_compact", handler);

// Agent events
api.on("before_agent_start", handler);
api.on("agent_start", handler);
api.on("agent_end", handler);

// Message events
api.on("message_start", handler);
api.on("message_update", handler);
api.on("message_end", handler);

// Tool events
api.on("tool_call", handler);           // Before execution
api.on("tool_result", handler);          // After execution
api.on("tool_execution_start", handler);
api.on("tool_execution_update", handler);
api.on("tool_execution_end", handler);

// Model events
api.on("model_select", handler);

// Context events
api.on("context", handler);              // Modify messages
api.on("before_provider_request", handler);
api.on("after_provider_response", handler);
```

### Register Tools

```typescript
api.registerTool({
  name: "tool_name",
  label: "Human Readable Label",
  description: "Description for LLM",
  parameters: { /* TypeBox schema */ },
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    return {
      content: [{ type: "text", text: "result" }],
      details: { /* metadata */ },
      isError: false,
    };
  },
});
```

### Register Commands

```typescript
api.registerCommand("command-name", {
  description: "Description",
  getArgumentCompletions: (prefix) => [{ label: "option" }],
  handler: async (args, ctx) => {
    // args is string after command
  },
});
```

### UI Methods

```typescript
// Show notification
api.ui.notify("Message", "info");

// Set status
api.ui.setStatus("key", "text");

// Set widget
api.ui.setWidget("key", ["line1", "line2"], { placement: "aboveEditor" });

// Set footer
api.ui.setFooter(factoryFunction);

// Set header
api.ui.setHeader(factoryFunction);

// Custom dialog
const result = await api.ui.select("Title", ["option1", "option2"]);
const confirmed = await api.ui.confirm("Title", "Message");
const input = await api.ui.input("Title", "Placeholder");

// Custom editor
api.ui.setEditorComponent(factoryFunction);
```

### Context Methods

```typescript
// Check if idle
ctx.isIdle();

// Abort current operation
ctx.abort();

// Check pending messages
ctx.hasPendingMessages();

// Get context usage
ctx.getContextUsage();

// Compact context
ctx.compact({ customInstructions: "..." });

// Get system prompt
ctx.getSystemPrompt();

// Shutdown
ctx.shutdown();
```

### Command Context Methods (for slash commands)

```typescript
// Wait for idle
await ctx.waitForIdle();

// New session
await ctx.newSession({ withSession: (ctx) => { /* setup */ } });

// Fork session
await ctx.fork(entryId, { withSession: (ctx) => { /* setup */ } });

// Navigate tree
await ctx.navigateTree(entryId, { summarize: true });

// Switch session
await ctx.switchSession(sessionPath, { withSession: (ctx) => { /* setup */ } });

// Reload
await ctx.reload();

// Send message
await ctx.sendMessage({
  customType: "type",
  content: "message",
});

await ctx.sendUserMessage("Hello");
```

### Provider Registration

```typescript
api.registerProvider("provider-name", {
  baseUrl: "https://api.example.com",
  apiKey: "API_KEY_ENV_VAR",
  api: "openai-chat-completions", // or "anthropic-messages"
  models: [
    {
      id: "model-id",
      name: "Model Name",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 8192,
      maxTokens: 4096,
    },
  ],
  // Optional
  headers: { "Custom-Header": "value" },
  authHeader: true,
  streamSimple: customStreamFunction,
  oauth: {
    name: "Provider Name",
    async login(callbacks) { /* ... */ },
    async refreshToken(credentials) { /* ... */ },
    getApiKey(credentials) { return credentials.access; },
    modifyModels(models, credentials) { return models; },
  },
});
```

## Project Structure

### Simple Extension (Single File)

```
~/.piclaw/agent/extensions/
└── my-extension.ts
```

### Complex Extension (Multiple Files)

```
my-piclaw-extension/
├── src/
│   ├── index.ts          # Main entry
│   ├── tools/
│   │   └── my-tool.ts
│   ├── commands/
│   │   └── my-command.ts
│   └── utils/
│       └── helpers.ts
├── package.json
└── tsconfig.json
```

### Package.json

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
  "dependencies": {
    "@mariozechner/pi-coding-agent": "^0.73.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

## Testing Extensions

### Manual Testing

1. Start Piclaw with verbose mode:
   ```bash
   piclaw --verbose
   ```

2. Check extension loads:
   ```
   Extension loaded: my-extension.ts
   ```

3. Test commands/tools

### Automated Testing

```typescript
import { describe, it, expect, vi } from "vitest";
import myExtension from "../src/index.js";

describe("my-extension", () => {
  it("registers commands", () => {
    const mockApi = {
      registerCommand: vi.fn(),
      registerTool: vi.fn(),
      on: vi.fn(),
    } as any;
    
    myExtension(mockApi);
    
    expect(mockApi.registerCommand).toHaveBeenCalledWith(
      "hello",
      expect.any(Object)
    );
  });
});
```

## Publishing Extensions

### Option 1: NPM Package

```bash
# Build
npm run build

# Publish
npm publish
```

Users install via:
```bash
pi install npm:my-piclaw-extension
```

### Option 2: Git Repository

```bash
pi install git:github.com/user/my-piclaw-extension
```

### Option 3: Local File

```bash
pi install /path/to/extension
```

## Best Practices

### 1. Error Handling

```typescript
execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  try {
    const result = await doSomething(params);
    return {
      content: [{ type: "text", text: result }],
      details: { success: true },
      isError: false,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      details: { error: error.message },
      isError: true,
    };
  }
}
```

### 2. Use AbortSignal

```typescript
execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  if (signal?.aborted) {
    throw new Error("Aborted");
  }
  
  const result = await fetch(url, { signal });
  // ...
}
```

### 3. Stream Progress

```typescript
execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  for (let i = 0; i < 100; i += 10) {
    onUpdate?.({
      type: "text",
      text: `Progress: ${i}%`,
    });
    await delay(100);
  }
  
  return {
    content: [{ type: "text", text: "Complete!" }],
    isError: false,
  };
}
```

### 4. Validate Inputs

```typescript
parameters: {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    count: { type: "number", minimum: 1 },
  },
  required: ["name"],
}
```

### 5. Provide Good Descriptions

```typescript
{
  name: "search_code",
  label: "Search Code",
  description: "Search for code patterns using ripgrep",
  promptSnippet: "Search code with ripgrep",
  promptGuidelines: [
    "Use specific patterns for better results",
    "Limit search to specific directories for speed",
  ],
}
```

## Common Patterns

### Pattern 1: File Operation Tool

```typescript
api.registerTool({
  name: "read_file",
  label: "Read File",
  description: "Read and display file contents",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      maxLines: { type: "number", default: 100 },
    },
    required: ["path"],
  },
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    const result = await ctx.exec("cat", [params.path]);
    return {
      content: [{ type: "text", text: result.stdout }],
      isError: false,
    };
  },
});
```

### Pattern 2: API Call Tool

```typescript
api.registerTool({
  name: "http_get",
  label: "HTTP GET",
  description: "Make HTTP GET request",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", format: "uri" },
    },
    required: ["url"],
  },
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    const result = await ctx.exec("curl", ["-s", params.url]);
    return {
      content: [{ type: "text", text: result.stdout }],
      isError: false,
    };
  },
});
```

### Pattern 3: Workflow Command

```typescript
api.registerCommand("setup-project", {
  description: "Initialize project setup",
  handler: async (args, ctx) => {
    await ctx.sendMessage({
      content: "Setting up project...",
    });
    
    await ctx.exec("npm", ["install"]);
    await ctx.exec("npm", ["run", "build"]);
    
    await ctx.sendMessage({
      content: "✓ Project setup complete!",
    });
  },
});
```

### Pattern 4: Context-Aware Tool

```typescript
api.registerTool({
  name: "git_status",
  label: "Git Status",
  description: "Show git status for current directory",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    // Use current working directory from context
    const result = await ctx.exec("git", ["status"], { cwd: ctx.cwd });
    return {
      content: [{ type: "text", text: result.stdout }],
      isError: false,
    };
  },
});
```

## Troubleshooting

### Extension Not Loading

- Check console for errors
- Verify file path in `settings.json`
- Ensure file has `.ts` or `.js` extension
- Try `/reload` command

### Tool Not Available

- Check tool name matches exactly
- Verify tool is registered (check console)
- Restart Piclaw

### Command Not Showing

- Type `/` to see all commands
- Check command is registered
- Restart Piclaw

### Type Errors

- Run `npm run typecheck`
- Check TypeScript version
- Verify `@mariozechner/pi-coding-agent` version

## Examples

See `llm-context/packages/coding-agent/examples/extensions/` for complete examples:

- Doom game extension
- Q&A tool
- Auto-continue extension
- Memory tool

## Resources

- [API Types](./API_EXPORT_FROM_CODING_AGENT.md)
- [Extension Examples](https://github.com/badlogic/pi-mono/tree/main/llm-context/packages/coding-agent/examples/extensions)
- [Discord Community](https://discord.com/invite/3cU7Bz4UPx)

## License

Same as Piclaw (APACHE)

---

*Last updated: 2026-05-06*
