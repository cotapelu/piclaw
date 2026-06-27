# Contributing to PiClaw

Thank you for your interest in improving PiClaw! This guide will help you set up your development environment and understand the contribution process.

## Quick Start

1. **Fork and clone**
   ```bash
   git clone https://github.com/your-username/piclaw.git
   cd piclaw
   ```

2. **Install dependencies**
   ```bash
   npm ci
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Start the TUI**
   ```bash
   ./dist/cli.js
   ```

## Development Workflow

We follow the autonomous development protocol defined in `AGENTS.md`. In short:

- Each change should be small, focused, and well-tested.
- All code must pass TypeScript compilation and tests.
- Add unit tests for new logic.
- Update documentation as needed.
- Commit with clear messages using conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`).

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes, following the coding standards in `AGENTS.md`.

3. Run the full test suite and fix any failures:
   ```bash
   npm test
   ```

4. Build to ensure TypeScript compiles:
   ```bash
   npm run build
   ```

5. Commit with a descriptive message:
   ```bash
   git add -A
   git commit -m "feat: add new widget memoization"
   ```

6. Push and open a Pull Request.

## Reproducible Integration Tests (Docker)

For testing in a clean, isolated environment—especially integration tests that start servers, spawn processes, or require system dependencies—use the provided Docker setup.

### Prerequisites
- Docker and Docker Compose installed.

### Build and Run Tests
```bash
# Build the test image (only needed once or after dependency changes)
docker compose -f docker-compose.test.yml build

# Run the full test suite
docker compose -f docker-compose.test.yml run --rm test-runner

# Or use the convenience script
./scripts/docker-run-tests.sh
```

### Environment Variables
You can pass environment variables to the test container:
```bash
PICLAW_CHAOS_RATE=0.1 ./scripts/docker-run-tests.sh
```

### Notes
- The Docker image is based on `node:20-alpine` and installs build dependencies for native modules.
- Source code is mounted as a volume, so changes on the host are reflected inside the container.
- The container runs as a non-root user for security.
- This setup is also used in CI to ensure consistent test runs.

## Extension Development

PiClaw is built on a modular extension system. Extensions can register tools, commands, slash commands, widgets, and event handlers.

### Extension Structure

An extension is a TypeScript module that exports an `extensionsAggregator` function:

```ts
import { ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

export function extensionsAggregator(pi: ExtensionAPI) {
  // Register tools, commands, etc.
  pi.registerTool(myTool);
  pi.registerCommand("my-cmd", { handler: myHandler });
}
```

### Key Extension Points

- **Tools**: LLM-callable functions. Define parameters with TypeBox schemas.
- **Commands**: User-invoked via `/command`. Can be async and use the full `ctx` API.
- **Widgets**: Custom renderers that attach to the TUI (above/below editor). Use `ctx.ui.setWidget()`.
- **Event Handlers**: Subscribe to lifecycle events (`session_start`, `tool_execution_end`, etc.) via `pi.on(event, handler)`.

See `extension-template/` for a minimal working example.

### Tool Example

A tool that computes a sum:

```ts
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("sum-tool");

const sumTool = defineTool({
  name: "sum",
  label: "Sum Numbers",
  description: "Adds two numbers together",
  parameters: Type.Object({
    a: Type.Number({ description: "First number" }),
    b: Type.Number({ description: "Second number" }),
  }),
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    const result = params.a + params.b;
    logger.info(`Sum ${params.a} + ${params.b} = ${result}`);
    return { result: `Sum: ${result}` } as any;
  },
});

export function extensionsAggregator(pi: ExtensionAPI) {
  pi.registerTool(sumTool);
}
```

### Command Example

A slash command that shows a notification:

```ts
import { type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("hello-cmd");n
export async function helloCommand(args: string, ctx: ExtensionCommandContext) {
  const name = args.trim() || "World";
  ctx.ui.notify(`Hello, ${name}!`, "info");
  logger.info(`Greeted ${name}`);
}

export function extensionsAggregator(pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Greet someone",
    handler: helloCommand,
  });
}
```

### Widget Example

A widget that shows the current time:

```ts
import { type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("clock-widget");

const WIDGET_KEY = "clock";

function buildClockLines(theme: any): string[] {
  const now = new Date();
  const time = now.toLocaleTimeString();
  return [
    theme.fg("accent", "🕒 Clock").bold(),
    `", " }
    `Current time: ${time}`,
  ];
}

function startClockWidget(ctx: ExtensionContext) {
  const state: { intervalId: NodeJS.Timeout | null } = { intervalId: null };
  const refresh = () => {
    const lines = buildClockLines(ctx.ui.theme);
    ctx.ui.setWidget(WIDGET_KEY, lines);
  };
  refresh(); // initial
  state.intervalId = setInterval(refresh, 1000);
  return state;
}

function stopClockWidget(state: { intervalId: NodeJS.Timeout | null }) {
  if (state.intervalId) clearInterval(state.intervalId);
  ctx.ui.setWidget(WIDGET_KEY, undefined);
}

export function extensionsAggregator(pi: ExtensionAPI) {
  pi.on("session_start", (event, ctx) => {
    const state = startClockWidget(ctx);
    pi.once("session_shutdown", () => stopClockWidget(state));
  });
}
```

### Event Handlers

Listen to agent events to implement custom behavior:

```ts
pi.on("tool_execution_end", async (event, ctx) => {
  if (event.toolName === "read" && event.isError) {
    ctx.ui.notify(`Read failed: ${event.result.error}", "error");
  }
});
```

### Extension API (ctx.*)

Inside command handlers and event callbacks, you receive `ctx: ExtensionContext` (or `ExtensionCommandContext` for commands):

- `ctx.ui`: UI methods (dialogs, widgets, notifications)
- `ctx.sessionManager`: Read-only session access
- `ctx.modelRegistry`: Resolve API keys and model info
- `ctx.exec(command, args)`: Execute shell commands
- `ctx.isIdle()`, `ctx.abort()`, `ctx.compact()`, etc.

For full API details, see the type definitions in `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`.

### Best Practices

- Keep tools small and single-purpose.
- Use structured logging: `import { createLogger } from "../utils/logger.js";`
- Validate inputs with TypeBox schemas.
- Escape shell arguments using `escapeShellArg` from `git-tool.ts` when constructing commands.
- Avoid heavy synchronous work in event handlers; offload to background if needed.
- Write tests for your extension (place in `src/extensions/tests/` or `src/tests/`).
- Mark long-running operations with `ctx.setWorkingVisible(true)` and provide progress.

### Registering Extensions

To include your extension in the main app, add it to `src/extensions/factory.ts`:

```ts
import { myExtension } from "./my-extension.js";

export function registerExtensions(pi: ExtensionAPI) {
  // ... existing registrations ...
  myExtension(pi);
}
```

Then rebuild (`npm run build`) and restart the TUI.

## Testing

- Place unit tests in `src/tests/` or `__tests__/` directories.
- Use `vitest` for testing. We use `@earendil-works/*` test fixtures when needed.
- Aim for high coverage, especially for security-critical code.
- Use `test.describe()` and `test()` from `vitest`.

Run tests with:
```bash
npm test
```

For watch mode:
```bash
npm test -- --watch
```

## Code Style

- TypeScript strict mode.
- 2-space indentation.
- Single quotes for strings.
- No trailing commas in object literals (unless multi-line).
- Use `camelCase` for variables and functions, `PascalCase` for classes.
- JSDoc comments for public functions and classes.

Use Prettier to format:
```bash
npm run format
```

## Security

- **Never** use `eval()` or `Function` constructor.
- Always escape shell arguments; use `escapeShellArg` helper.
- Validate file paths; prevent directory traversal.
- Do not log secrets; mask sensitive data.
- Follow the security guidelines in `SECURITY.md`.

## Performance

- UI updates should be fast (< 100ms). Use memoization to avoid unnecessary re-renders.
- Team operations should be lock-free when possible; minimize critical sections.
- Memory usage: avoid leaks, clean up event listeners and intervals.

## Metrics & Observability

- Use `logger` for all logs.
- Widgets can record performance via `src/extensions/utils/widget-performance.ts`.
- Team metrics are exported to `.piclaw/metrics.json` on auto-dispose.

## Documentation

- Update `README.md` for user-facing changes.
- Update `docs/` (AGENT_METRICS.md, EVOLUTION.md) when you complete a significant iteration.
- Document new tools with clear descriptions and examples.

## Community

Be respectful and constructive in issues and pull requests. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

## Questions?

Open an issue or reach out in the discussion forum.

---

Happy hacking!
