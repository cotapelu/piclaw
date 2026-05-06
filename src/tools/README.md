# SubTool Loader

## Overview

The **SubTool Loader** is a unified interface that exposes 50+ system operations as a single tool. Instead of managing dozens of separate tools, the LLM can call `subtool_loader` with any supported sub-tool name and arguments.

## Architecture

The SubTool Loader combines:
- **7 Core Tools** from `@mariozechner/pi-coding-agent`: `bash`, `ls`, `find`, `grep`, `read`, `edit`, `write`
- **50+ Custom Sub-Tools**: System operations across categories like Git, Docker, Kubernetes, AWS, Terraform, databases, package managers, etc.

## Usage

### Basic Syntax

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
- `subtool` (string, required) - The sub-tool name to execute
- `args` (object, required) - Arguments for the sub-tool
  - `command` (string, required) - The command to execute
  - `cwd` (string, optional) - Working directory
  - `timeout` (number, optional) - Timeout in seconds
- Additional parameters specific to each sub-tool

### Schema Introspection

Use `get_schema` to get the JSON schema for any sub-tool:

```json
{
  "subtool": "get_schema",
  "args": {
    "name": "bash"
  }
}
```

## Available Sub-Tools

### Core Tools (from pi-coding-agent)
- `bash` - Execute bash commands
- `ls` - List directory contents
- `find` - Find files
- `grep` - Search text patterns
- `read` - Read file contents
- `edit` - Edit files
- `write` - Write files

### Version Control
- `git` - Git operations (clone, commit, push, pull, branches)

### Containers
- `docker` - Docker container management
- `k8s` - Kubernetes cluster operations

### Cloud & Infrastructure
- `aws` - AWS CLI operations
- `terraform` - Infrastructure as code

### Databases
- `db` - Generic database operations
- `kafka` - Kafka message queue
- `redis` - Redis cache operations
- `mysql` - MySQL database
- `psql` - PostgreSQL database
- `mongodb` - MongoDB operations

### Package Managers
- `npm` - Node.js packages
- `apt` - Debian/Ubuntu packages
- `yum` - RHEL/CentOS packages
- `dnf` - Fedora packages
- `pacman` - Arch Linux packages
- `pip` - Python packages
- `cargo` - Rust packages
- `go` - Go packages
- `maven` - Java packages

### System Management
- `systemctl` - Systemd service management
- `journalctl` - System journal
- `ps` - Process listing
- `kill` - Kill processes
- `top` / `htop` - Process monitoring
- `vmstat` / `mpstat` / `sar` - System performance
- `df` - Disk space
- `du` - Directory usage
- `mount` - Mount filesystems
- `crontab` - Scheduled tasks
- `ufw` - Firewall management

### Network
- `ping` - Network connectivity
- `traceroute` - Network path tracing
- `nslookup` / `dig` - DNS queries
- `ssh` - SSH connections
- `scp` - Secure file copy
- `sftp` - SFTP file transfer
- `netstat` / `ss` - Network statistics
- `iptables` / `nft` - Firewall rules
- `tcpdump` - Packet capture
- `socat` - Network relay
- `wget` / `curl` - HTTP downloads
- `httpie` - HTTP client

### File Operations
- `tail` - Follow log files
- `cat` - Concatenate files
- `cp` - Copy files
- `mv` - Move files
- `rm` - Remove files
- `mkdir` - Create directories
- `tar` / `gz` / `7z` / `zip` - Archive operations
- `rsync` - Remote sync

### Development
- `git` - Version control
- `vim` / `nano` / `code` - Text editors
- `grep` / `find` - Code search
- `diff` - File comparison
- `tree` - Directory visualization

### Data Processing
- `jq` / `yq` - JSON/YAML processing
- `xmllint` - XML processing
- `csvkit` - CSV processing
- `pandoc` - Document conversion
- `imagemagick` / `ffmpeg` - Media processing

### Security
- `gpg` - Encryption
- `openssl` - SSL/TLS operations
- `ssh-keygen` - SSH key generation
- `nmap` - Port scanning
- `wireshark` / `tcpdump` - Network analysis

### Monitoring & Observability
- `prometheus` - Metrics collection
- `grafana` - Dashboards
- `elasticsearch` / `kibana` - Log analysis
- `datadog` - APM

### Scripting & Automation
- `bash` - Shell scripting
- `python` / `perl` / `ruby` / `php` - Scripting languages
- `make` - Build automation
- `cmake` - Build configuration

### Virtualization
- `docker` - Container runtime
- `k8s` - Container orchestration
- `qemu` - Virtual machines
- `vagrant` - VM automation

### Cloud CLI Tools
- `aws` - AWS CLI
- `az` - Azure CLI
- `gcloud` - Google Cloud CLI

### Package Managers (Extended)
- `conda` - Python environments
- `nix` - Nix package manager
- `spack` - HPC package manager
- `guix` - GNU Guix

### Miscellaneous
- `time` - Command timing
- `date` - Date/time
- `cal` - Calendar
- `weather` - Weather info
- `fortune` - Random quotes

## Safety Features

### Dangerous Tools Control

Some sub-tools are classified as "dangerous" (can modify system state or access sensitive resources):

```json
{
  "subtool": "configure",
  "args": {
    "allowDangerousTools": false
  }
}
```

When `allowDangerousTools` is `false`, dangerous tools will be blocked.

### Tool Disabling

Specific tools can be disabled:

```json
{
  "subtool": "configure",
  "args": {
    "disabledTools": ["rm", "format"]
  }
}
```

### Audit Logging

All sub-tool executions are logged with:
- Timestamp
- Tool name
- Arguments
- Success/failure status
- Duration
- Error messages (if any)

View audit log:
```json
{
  "subtool": "get_audit_log"
}
```

## Examples

### Example 1: Git Operations
```json
{
  "subtool": "git",
  "args": {
    "command": "clone https://github.com/user/repo.git"
  }
}
```

### Example 2: Docker Container List
```json
{
  "subtool": "docker",
  "args": {
    "command": "ps -a"
  }
}
```

### Example 3: Kubernetes Deployment
```json
{
  "subtool": "k8s",
  "args": {
    "command": "apply -f deployment.yaml",
    "context": "production"
  }
}
```

### Example 4: File Search
```json
{
  "subtool": "find",
  "args": {
    "path": "/var/log",
    "type": "f",
    "name": "*.log"
  }
}
```

### Example 5: Package Installation
```json
{
  "subtool": "apt",
  "args": {
    "command": "install -y nginx"
  }
}
```

### Example 6: Database Query
```json
{
  "subtool": "psql",
  "args": {
    "query": "SELECT * FROM users LIMIT 10",
    "connection": "postgresql://localhost/mydb"
  }
}
```

### Example 7: System Info
```json
{
  "subtool": "systemctl",
  "args": {
    "command": "status nginx"
  }
}
```

## Benefits

1. **Simplified Interface**: One tool instead of 50+
2. **Consistent API**: All sub-tools use the same parameter structure
3. **Safety Controls**: Configurable dangerous tool permissions
4. **Audit Trail**: All operations logged for compliance
5. **Flexibility**: Easy to add new sub-tools
6. **Introspection**: Get schemas dynamically

## Adding New Sub-Tools

To add a new sub-tool:

1. Create a file in `src/tools/sub-tools/` (e.g., `mytool.ts`)
2. Export `mytoolSchema` and `executeMytool`
3. Add to `src/tools/sub-tools/index.ts`
4. The tool is automatically available via `subtool_loader`

## Implementation Details

- **Schema Generation**: Uses TypeBox for JSON Schema validation
- **Tool Caching**: Tools are cached per working directory
- **Error Handling**: Errors are captured and returned as structured responses
- **Async Execution**: All sub-tools support async/await
- **Abort Signals**: Support for cancellation via AbortSignal

## Related

- [Core Tools](./core-tools.md) - bash, ls, find, grep, read, edit, write
- [Sub-Tools Index](../extensions/providers/models/index.ts) - All available sub-tools
- [PiClaw Architecture](../docs/pi-agent-core-analysis.md) - How tools fit into the system

## License

Part of the PiClaw project.
