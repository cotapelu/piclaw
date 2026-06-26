# PiClaw

PiClaw is a professional AI coding agent built on [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent). It provides a powerful terminal-based interface for AI-assisted development.

## Features

- **Rich Extension Ecosystem**: 23+ extensions including tools, commands, renderers, and widgets.
- **Integrated Tools**: `git` (full git operations), `test` (vitest runner), `formatter` (Prettier), `audit` (npm audit), `build` (npm run build), `metrics` (export stats), `memory` (persistent memories), `todos` (project todo management), `scripts` (npm scripts), `secret-scanner` (detect leaked keys).
- **Interactive Slash Commands**: `/tree` (session browser), `/settings` (config UI), `/providers` (LLM provider management), `/copy` (clipboard), `/team` (toggle team widget), `/scan-secrets` (security scan), `/scripts` (run npm scripts).
- **Custom Renderers**: Beautiful output for branch summaries, team ops, compaction summaries.
- **Session Widgets**: Live team status widget with toggle.
- **Secure by Default**: SDK factories, validated inputs, no eval; file writes use mutation queue.
- **Prompt Templates**: Built-in defaults (`default`, `explain`, `refactor`, `test`, `review`).
- **Highly Configurable**: `~/.piclaw/config.json` or CLI flags; thinking level and model persistence.
- **Modular Architecture**: Easy to add new extensions; all registered via `factory.ts`.

## Extension System

PiClaw loads extensions from `src/extensions/` automatically. Extensions can register:
- **Tools**: Callable by the LLM (e.g., `git`, `test`, `formatter`).
- **Commands**: Slash commands invoked by the user (e.g., `/tree`, `/team`).
- **Renderers**: Custom UI for tool results and session entries.
- **Widgets**: TUI components that display live information.

All extensions follow the SDK patterns for consistency and safety.

## Security Model

- No arbitrary `eval` or unsanitized command execution.
- Tools that run shell commands use `createBashTool` with safe defaults.
- File mutation operations use `withFileMutationQueue` to prevent race conditions.
- Secret scanner helps detect accidental key leaks.

For more details, see [docs/AGENT_PROFILE.md](docs/AGENT_PROFILE.md).

## Installation

```bash
# Clone and install
npm install
npm run build
npm link
```

## Usage

Start the interactive agent:

```bash
piclaw
```

Or with options:

```bash
piclaw --cwd /path/to/project --model anthropic:claude-opus-4-5 --thinking high --verbose
```

## Remote TUI via WebSocket

PiClaw can serve its terminal UI over WebSocket, allowing you to connect from a web browser on any device on your network.

### Start the WebSocket server

```bash
# Build first
npm run build

# Start WebSocket TUI on port 8080 (default)
piclaw --tui-websocket

# Custom port and bind address
piclaw --tui-websocket=9000 --tui-address=0.0.0.0

# Enable token authentication
piclaw --tui-websocket=8080 --tui-token=mysecret
```

Then open a browser to `http://localhost:8080/` (or your LAN IP). If you set a token, append it as `?token=mysecret`.

### How it works

- The `--tui-websocket` flag starts an HTTP server that serves a simple HTML page with xterm.js.
- Each WebSocket connection spawns a new `piclaw` CLI process attached to a PTY.
- The terminal input/output is forwarded over the WebSocket.
- You can pass additional CLI arguments (e.g., `--model`, `--session`) that are forwarded to the child process.

**Security**: By default the server only listens on `127.0.0.1`. Use `--tui-address=0.0.0.0` to expose on all interfaces (use with caution). Token authentication (`--tui-token`) is recommended when exposing beyond localhost.

### Notes

- The child process uses `dist/cli.js`, so you must run `npm run build` before enabling this feature.
- The server runs until you stop it (Ctrl+C).
- Connections are independent; each gets its own session and workspace.


### CLI Options

- `--cwd <path>` - Working directory (default: current)
- `--tools <list>` - Comma-separated tool allowlist (overrides config)
- `--sessionDir <dir>` - Custom session storage directory
- `--model <id>` - Model to use (e.g., `anthropic:claude-opus-4-5`)
- `--thinking <level>` - Thinking level: `off|minimal|low|medium|high|xhigh`
- `--verbose` - Show detailed logs

## Configuration

Piclaw stores configuration in `~/.piclaw/config.json`. Example:

```json
{
  "model": "anthropic:claude-opus-4-5",
  "thinking": "high",
  "tools": ["read", "bash", "edit", "write", "grep", "find"],
  "verbose": false
}
```

You can edit this file manually or use the `/piclaw-set` command inside the agent.

### Supported Config Keys

- `model` - Default model (`provider:modelId`)
- `thinking` - Default thinking level
- `tools` - Array of allowed tool names
- `sessionDir` - Custom session storage path
- `verbose` - Enable verbose logging

## Slash Commands

PiClaw adds several powerful slash commands to the standard pi set.

### Configuration
- `/settings` – Open interactive settings panel
- `/config` – Display current Piclaw configuration
- `/piclaw-set <key> <value>` – Set a configuration value (e.g., `/piclaw-set model anthropic:claude-opus-4-5`)
- `/tools` – List the currently allowed tools
- `/piclaw-status` – Show Piclaw and session status

### Navigation & Inspection
- `/tree` – Interactive session tree browser with entry details
- `/session` – Show session information

### Provider & Model Management
- `/providers` – Manage LLM providers (`list`, `add <name> <baseUrl> <apiKey>`, `remove <name>`, `test <name>`)

### Workspace Utilities
- `/copy` – Copy the last assistant response to clipboard
- `/scan-secrets` – Scan the workspace for leaked API keys and tokens
- `/scripts` – List and run npm scripts (`/scripts` to list, `scripts({ action: 'run', script: 'name' })`)

### Team & Collaboration
- `/team` – Toggle the team status widget visibility

### Standard pi Commands
- `/model` – Select model (opens UI)
- `/thinking` – Change thinking level
- `/quit` – Exit
- ... and many more. Press `/` in the app to see all commands.

## Development

```bash
# Build
npm run build

# Run in dev mode (tsx)
npm run dev

# Lint
npm run lint

# Type check
npm run check

# Test
npm test
```

## How It Works

Piclaw extends pi-coding-agent with:

1. **Config Manager** - Loads/saves user configuration
2. **CLI Resolution** - Merges CLI options with config file
3. **Tool Allowlist** - Applies `tools` config to session
4. **Auto-Loaded Extension** - Registers custom slash commands via global settings

On startup, Piclaw:
- Loads config from `~/.piclaw/config.json`
- Merges with CLI overrides
- Registers the built-in piclaw extension (written in `src/extensions/piclaw-extension.ts`)
- Creates agent session with allowed tools from config
- Applies initial model and thinking level

## Extension Architecture

Piclaw's custom extension is automatically registered by writing its path to the global settings file (`~/.piclaw/agent/settings.json`). This happens on every startup (if not already present).

To create your own extension, place a `.ts` or `.js` file in:
- Global: `~/.pi/agent/extensions/`
- Project: `<project>/.pi/extensions/`

See examples in `llm-context/packages/coding-agent/examples/extensions/`.

## License

APACHE

---

## Team Collaboration

PiClaw supports multi-agent team collaboration. Spawn multiple agents to work together on tasks with automatic work distribution, messaging, and conflict resolution.

### Key Features

- **Dynamic task assignment** with work stealing
- **Message bus** for agent-to-agent communication
- **Shared workspace** with optimistic locking & conflict resolution
- **Team context** for shared awareness of progress, blockers, decisions
- **Auto-continue** across team members

### Usage

Use the `spawn_team` tool to create and manage teams:

```javascript
spawn_team({ action: "create", tasks: ["Design API", "Implement backend", "Write tests"], size: 3 })
```

Child agents can use `team_ops` to coordinate:

```javascript
team_ops({ action: "claim_task" })  // Get next available task
team_ops({ action: "workspace_write", key: "design", value: "{}" })  // Share data
team_ops({ action: "send_message", channel: "team.chat", content: "Done with task 1" })
```

Events emitted: `team_created`, `team_progress`, `team_completed`, `team_disposed`.

---

## Custom Tools & Extensions

PiClaw includes several built-in custom tools extending the base pi-coding-agent:

- **todos** - Full-featured todo management with phases & tasks (persists to `.piclaw/agent/todos.json`)
- **memory** - Store and retrieve arbitrary text snippets with tags (persists in session)
- **echo** - Simple demonstration tool for custom tool registration
- **system_info** - Get system diagnostics (OS, memory, CPU, uptime)
- **team** / **team_ops** - Team collaboration tools

Additionally, custom provider support allows adding new LLM providers (e.g., Kilo Gateway).

---

## Metrics & Observability

Team collaboration includes optional metrics collection to monitor performance and diagnose issues.

### Enabled Metrics

- Task completion times & distribution
- Agent workload & efficiency
- Workspace conflicts & lock wait times
- Message traffic & channel usage
- Work stealing frequency & success rate
- Help requests & assistance provided

### Accessing Metrics

```javascript
// After team completion, get metrics summary
const summary = teamMetrics.getSummary();
console.log(summary);

// Export to JSON for analysis
await exportMetricsToFile(team, "./metrics.json");
```

Metrics are collected via `src/team/team-metrics.ts` and integrated via `src/team/team-metrics-integration.ts`. See [CONTRIBUTING.md](CONTRIBUTING.md) for integration details.

---

## Development
