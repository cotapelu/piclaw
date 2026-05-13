# PiClaw

PiClaw is a professional AI coding agent built on [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent). It provides a powerful terminal-based interface for AI-assisted development.

## Features

- Persistent configuration management (`~/.piclaw/config.json`)
- Custom slash commands:
  - `/config` - Show current Piclaw configuration
  - `/piclaw-set <key> <value>` - Set a config value (e.g., `/piclaw-set model anthropic:claude-opus-4-5`, `/piclaw-set thinking high`)
  - `/tools` - List active tools
  - `/piclaw-status` - Show Piclaw and session status
- Automatic tool allowlist from config
- Model and thinking level persistence across sessions
- Extension system for custom commands
- **SubTool Loader** – a single custom built-in tool exposing 50+ system operations (bash, git, docker, k8s, ssh, http, aws, terraform, db, kafka, redis, make, npm, systemctl, journalctl, ps, kill, crontab, apt, yum, df, du, ping, traceroute, nslookup, dig, wget, tail, jq, yq, xmllint, scp, rsync, ffmpeg, update, backup, password, weather, time, ufw, at, quota, iso, free, iostat, netstat, ss, ...). See [SubTool Loader](#subtool-loader) for details.

## SubTool Loader

The SubTool Loader is a unified interface for executing 50+ common system commands and tools. Instead of managing dozens of separate tools, it's exposed as a single `subtool_loader` tool that can execute any supported command.

### Available Sub-Tools

| Category | Tools |
|----------|-------|
| **Version Control** | git |
| **Containers** | docker, k8s |
| **Cloud** | aws, terraform |
| **Databases** | db, kafka, redis |
| **Package Managers** | npm, apt, yum |
| **Systemd** | systemctl, journalctl |
| **Processes** | ps, kill, crontab |
| **System Info** | df, du, free, iostat, netstat, ss |
| **Network** | ping, traceroute, nslookup, dig, wget |
| **File Ops** | tail, scp, rsync |
| **Data Processing** | jq, yq, xmllint |
| **Media** | ffmpeg |
| **Security** | ufw, ssh |
| **Utilities** | update, backup, password, weather, time, at, quota, iso |
| **Computer Use** | bash, ls, find, grep, read |

### Usage

The LLM can call `subtool_loader` with any sub-tool name and arguments:

```json
{
  "subtool": "git",
  "args": {
    "command": "status"
  }
}
```

```json
{
  "subtool": "docker",
  "args": {
    "command": "ps -a",
    "timeout": 30
  }
}
```

```json
{
  "subtool": "k8s",
  "args": {
    "command": "get pods -n default",
    "context": "production"
  }
}
```

### Common Parameters

All sub-tools support:
- `command` (string, required) - The command to execute
- `cwd` (string, optional) - Working directory
- `timeout` (number, optional) - Timeout in seconds

### Documentation

For complete usage examples for all 50+ sub-tools, see [docs/subtool-usage.md](docs/subtool-usage.md).

### Security Note

⚠️ Sub-tools execute arbitrary shell commands. Only use in trusted environments.

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

Built-in commands (from pi):
- `/model` - Select model (opens UI)
- `/thinking` - Change thinking level
- `/settings` - Open settings menu
- `/session` - Show session info
- `/quit` - Exit
... and many more. Press `/` in the app to see all commands.

Piclaw-specific commands:
- `/config` - Show Piclaw config
- `/piclaw-set <key> <value>` - Set a config key/value
- `/tools` - Show active tools
- `/piclaw-status` - Show Piclaw status

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
