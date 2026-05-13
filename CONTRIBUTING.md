# Contributing to PiClaw

Thank you for contributing! This document provides guidelines for adding new features, especially sub-tools.

## Table of Contents
- [Codebase Overview](#codebase-overview)
- [Adding a New Sub-Tool](#adding-a-new-sub-tool)
- [Sub-Tool Implementation Pattern](#sub-tool-implementation-pattern)
- [Testing](#testing)
- [Code Style](#code-style)
- [Team Collaboration Features](#team-collaboration-features)

## Codebase Overview

PiClaw is built on top of `@mariozechner/pi-coding-agent` and follows this architecture:

```
piclaw/
├─ src/
│  ├─ cli.ts              # Entry point with process setup
│  ├─ main.ts             # Main bootstrap flow
│  ├─ piclaw-core.ts      # Core runtime creation with customization
│  ├─ config/             # Configuration management
│  ├─ tools/
│  │   ├─ subtool-loader.ts    # Unified tool for 100+ system operations
│  │   └─ sub-tools/           # Individual sub-tool implementations
│  ├─ extensions/         # Custom extensions (tools, providers, hooks)
│  ├─ team/               # Multi-agent collaboration system
│  └─ tests/              # Unit & integration tests
├─ package.json
└─ README.md
```

**Key Principle**: We use a "Dual Dependency Model":
- **Runtime**: npm packages (`@mariozechner/pi-coding-agent`, etc.)
- **Reasoning**: Clone of upstream source in `llm-context/` for LLM context

Never import from `llm-context/` in production code - it's for reading only.

## Adding a New Sub-Tool

The SubTool Loader provides a unified interface for system operations. To add a new sub-tool:

### Step 1: Create the Sub-Tool File

Create a new file in `src/tools/sub-tools/` following the pattern, e.g., `my-tool.ts`:

```typescript
import { Type } from "typebox";

export const myToolSchema = Type.Object({
  command: Type.String({ description: "Command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in ms" })),
  // Add other parameters as needed
});

export async function executeMyTool(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any  // ExtensionContext with exec() method
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };

  try {
    // Build safe argument array (avoid shell injection)
    const toolArgs = command ? command.split(/ \s+/) : [];

    // Use ctx.exec() which provides safe execution
    const result = await ctx!.exec("my-tool", toolArgs, { cwd, signal, timeout });

    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `My Tool error: ${error.message}` }],
      details: undefined,
      isError: true,
    } as const;
  }
}
```

### Step 2: Register in Index

Add exports to `src/tools/sub-tools/index.ts`:

```typescript
// Add import
export { myToolSchema, executeMyTool } from "./my-tool.js";
```

### Step 3: (Optional) Add Danger Flag

If the tool can execute arbitrary commands or access sensitive resources, mark it as dangerous:

```typescript
// In your tool definition when registering (if using custom tool)
export const myToolDefinition: SubToolDefinition = {
  name: "my_tool",
  label: "My Tool",
  description: "...",
  parameters: myToolSchema,
  execute: executeMyTool,
  dangerous: true,  // ← This flag
};
```

Dangerous tools can be disabled via SubToolLoader config (`allowDangerousTools: false`).

## Sub-Tool Implementation Pattern

All sub-tools follow this **consistent pattern**:

1. **Schema**: Use TypeBox (`Type.Object`) to define parameters with descriptions
2. **Signature**: `execute(args, cwd, signal?, ctx?)`
3. **Safe Execution**: Use `ctx.exec(toolName, argsArray, options)` - never use shell=True
4. **Argument Handling**: Split command strings safely (avoid shell injection)
5. **Error Handling**: Catch errors and return structured result with `isError: true`
6. **Result Format**: Return `{ content, details, isError }` (const assertions)

### Important: No Shell Injection

**DO NOT** do:
```typescript
await ctx.exec("bash", ["-c", `my-tool ${userInput}`]); // UNSAFE
```

**DO**:
```typescript
const args = buildToolArgs("my-tool", userCommand); // Safe splitting
await ctx.exec("my-tool", args, options);
```

See `src/tools/sub-tools/command-utils.ts` for helpers:
- `splitCommand()` - quote-aware splitting
- `escapeShellArg()` - escapes single quotes
- `buildToolArgs()` - builds safe arg array
- `buildSshArgs()` - safe SSH argument building

### Utility Functions

Reuse these patterns:

**Timeout handling**:
```typescript
const { timeout = 30000 } = args;
// Pass to ctx.exec({ timeout })
```

**Truncation**:
```typescript
const MAX_LINES = 1000;
const lines = output.split("\n");
const truncated = lines.length > MAX_LINES;
const limited = truncated ? lines.slice(0, MAX_LINES) : lines;
```

**Context file operations**:
```typescript
const fs = await import("node:fs/promises");
const content = await fs.readFile(filePath, "utf-8");
```

## Testing

### Unit Tests

Each sub-tool should have unit tests in `src/tests/sub-tools/`:

```typescript
import { describe, it, expect } from 'vitest';
import { executeMyTool } from '../src/tools/sub-tools/my-tool.js';

describe('My Tool', () => {
  it('should execute successfully', async () => {
    const mockCtx = {
      exec: async (tool: string, args: string[], opts: any) => ({
        code: 0,
        stdout: "success",
        stderr: "",
        killed: false,
      }),
    };

    const result = await executeMyTool(
      { command: "test" },
      "/tmp",
      undefined,
      mockCtx
    );

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("success");
  });

  it('should handle errors', async () => {
    const mockCtx = {
      exec: async () => { throw new Error("Execution failed"); },
    };

    const result = await executeMyTool(
      { command: "fail" },
      "/tmp",
      undefined,
      mockCtx
    );

    expect(result.isError).toBe(true);
  });
});
```

### Integration Tests

Team features should have integration tests in `src/tests/team/integration/` covering:
- Team creation & initialization
- Task claiming & completion flow
- Work stealing scenarios
- Message bus communication
- Workspace shared state
- Conflict resolution cases

## Code Style

We use ESLint with TypeScript. Run:

```bash
npm run lint      # Check and auto-fix
npm run check     # Type check
npm test          # Run all tests
```

### Key Rules

- Avoid `any` - use proper types
- Handle unused variables (remove or `_` prefix)
- Avoid `await` in loops (use `Promise.all` if parallel)
- Use `const`/`let` appropriately
- Add JSDoc comments for public functions

## Team Collaboration Features

If adding features related to the team system (`src/team/`):

### Key Components

- **TeamContextManager**: Shared state (agentStates, taskStates, decisions, blockers)
- **TeamMessageBus**: Pub/sub messaging with channels
- **DynamicTaskManager**: Work stealing, load balancing
- **ConflictResolutionManager**: Locking, versioning, merge strategies
- **CollaborativeWorkspace**: Shared key-value store with conflict detection

### Adding New Team Actions

1. Define action in `team-ops-tool.ts` parameters enum
2. Implement case in `execute()` switch
3. Emit events to `team.events` channel for parent observation
4. Update team context if needed
5. Add tests for the new action

### Event Types

Standard events emitted to `team.events`:
- `team_started`
- `agent_started`
- `agent_completed`
- `agent_error`
- `task_claimed`
- `task_released`
- `task_stolen`
- `message_sent`
- `status_changed`
- `team_completed`

## Performance Considerations

- **Audit Logging**: Async fire-and-forget, never block execution
- **File Persistence**: Atomic writes (tmp → rename) to prevent corruption
- **History**: Debounced saves (100ms) to batch rapid updates
- **Context Logging**: Non-blocking errors, catches all exceptions
- **Team Monitor**: Polling interval 2s - adjust if needed

## Security

- All sub-tools must use safe execution (arg arrays, no shell)
- Dangerous tools must be flagged (can be disabled)
- API keys validated from environment, never logged
- Audit log writes to `~/.piclaw/agent/audit.log` (mode 0o600)
- Lock TTL (5min) prevents permanent deadlocks

## Questions?

Open an issue or check:
- `SYSTEM.md` - Architecture deep dive
- `README.md` - User documentation
- `llm-context/` - Upstream source for reference

Happy coding! 🚀
