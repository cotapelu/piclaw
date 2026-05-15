/**
 * Type definitions for sub-tools system
 */

// List of all available sub-tool names
export const subToolNames = [
  // Core Computer Use tools (provided by @mariozechner/pi-coding-agent)
  "get_schema",
  "bash", "ls", "find", "grep", "read",
  "edit", "write",

  // Extended sub-tools (custom in src/tools/sub-tools/)
  "git", "docker", "docker-compose", "podman", "k8s", "kubectl-apply", "helm", "oc", "nomad", "vagrant", "virsh", "qemu", "lxc", "systemd-nspawn", "chroot", "flatpak", "sqlite3", "mysql", "psql", "mongodb", "redis", "kafka-console", "pip", "cargo", "go", "maven", "dotnet", "cmake", "yarn", "deno", "php", "ruby", "ssh", "http", "aws",
  "terraform", "db", "kafka", "redis", "make", "npm",
  "systemctl", "sysctl", "iptables", "nft", "lvm", "lsof", "pstree", "top", "htop", "vmstat", "mpstat", "sar", "mount", "hardware", "dmidecode", "sensors", "battery", "journalctl", "ps", "kill", "crontab",
  "apt", "yum", "df", "du", "ping", "traceroute",
  "nslookup", "dig", "wget", "tail", "jq", "yq",
  "xmllint", "scp", "rsync", "ffmpeg", "update",
  "backup", "password", "weather", "time", "ufw",
  "at", "quota", "iso", "free", "iostat", "netstat", "ss",

  // New sub-tools (Phase 10-13)
  "pandoc", "wkhtmltopdf", "pdftk", "ps2pdf", "enscript", "graphviz", "xmlstarlet", "json_pp", "yamllint", "tomlq", "hjson",
  "archive", "zip", "7z", "xz",
  "svn", "hg", "darcs", "fossil", "bzr", "cvs",
  "pacman", "dnf", "zypper", "emerge", "apk", "pkg", "nix-env", "guix", "spack", "pkgsrc",
] as const;

export type SubToolName = typeof subToolNames[number];

/**
 * Sub-tool definition interface
 */
export interface SubToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: any;
  execute: any;
  renderCall?: any;
  renderResult?: any;
  renderShell?: "self" | "child";
  /** If true, this tool can execute arbitrary commands and should be treated with caution */
  dangerous?: boolean;
  /** If true, this tool should use safe execution (direct spawn, not bash -c) */
  safeExecute?: boolean;
}

/**
 * Sub-tool map type
 */
export type SubToolMap = Record<string, SubToolDefinition>;

/**
 * Get schema function arguments
 */
export interface GetSchemaArgs {
  name: string;
}

/**
 * Subtool loader arguments
 */
export interface SubToolLoaderArgs {
  subtool: string;
  args: any;
}