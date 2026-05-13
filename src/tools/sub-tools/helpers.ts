/**
 * Helper functions for sub-tools system
 */

import * as subTools from "./index.js";
import { subToolNames, type SubToolMap, type SubToolName } from "./types.js";

// Core tools from @mariozechner/pi-coding-agent
const coreToolNames = new Set<string>(["bash", "ls", "find", "grep", "read", "edit", "write", "get_schema"]);

// List of dangerous tools that can execute arbitrary commands or access sensitive resources
// These tools can affect system state, execute code, or access sensitive data.
// They can be disabled via SubToolLoader config (allowDangerousTools: false).
export const DANGEROUS_TOOLS = new Set<string>([
  // Shell & remote execution (arbitrary command execution)
  "bash", "sh", "zsh", "fish",
  "ssh", "scp", "sftp", "ftp", "smbclient", "netcat", "socat",

  // Container/Orchestration (execute in containers, change infra)
  "docker", "docker-compose", "podman",
  "kubectl", "kubectl-apply", "k8s", "helm", "oc", "nomad",

  // Virtualization/System isolation
  "virsh", "qemu", "lxc", "chroot", "systemd-nspawn", "vagrant",

  // System management (modify system state)
  "systemctl", "sysctl", "iptables", "nft", "lvm", "mount", "umount",
  "crontab", "at", "systemd",

  // Process management (kill, manage processes)
  "kill", "pkill", "pkexec", "sudo", "su", "ps", "pstree", "killall",

  // Databases (direct access, can read/write/modify data)
  "mysql", "psql", "sqlite3", "mongodb", "redis", "mongo",

  // Package managers (install/remove software, can modify system)
  "apt", "yum", "dnf", "zypper", "pacman", "emerge", "apk", "pkg",
  "nix-env", "guix", "spack", "pkgsrc", "npm", "yarn", "pnpm", "bun",

  // Build/Compile (can execute arbitrary build scripts)
  "make", "cmake", "ninja", "maven", "gradle", "ant", "dotnet", "msbuild",
  "cargo", "go", "make", "terraform",

  // Network diagnostics (can probe networks, potentially exploit)
  "ping", "traceroute", "nslookup", "dig", "whois", "tcpdump", "wireshark",

  // File operations (could overwrite/delete sensitive files if misused)
  "rm", "cp", "mv", "ln", "rsync", "scp", "dd", "wipe", "shred",

  // Cloud/Infrastructure (modify cloud resources)
  "aws", "terraform", "gcloud", "az", "doctl",

  // Version control (can access private repos, execute hooks)
  "git", "svn", "hg", "fossil", "bzr", "cvs", "darcs",

  // Scripting languages (can execute arbitrary code)
  "python", "perl", "ruby", "php", "lua", "r", "julia", "node", "deno", "bun",

  // Potentially destructive operations
  "update", "backup", "restore", "format", "fdisk", "parted",

  // Security tools (can affect system security)
  "ufw", "firewall-cmd", "iptables", "nft", "selinux", "apparmor",

  // Other elevated privileges
  "sudo", "su", "doas", "pfexec",
]);

/**
 * Cached tool definitions per working directory
 */
const toolCache = new Map<string, SubToolMap>();

/**
 * Get tool map for a given working directory
 * Builds the map of all available sub-tools
 */
export function getToolMap(cwd: string): SubToolMap {
  if (toolCache.has(cwd)) return toolCache.get(cwd)!;

  const tools: SubToolMap = {};

  for (const name of subToolNames) {
    if (coreToolNames.has(name)) continue; // Skip core tools

    const schemaKey = `${name}Schema`;
    const executeKey = `execute${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    const schema = (subTools as any)[schemaKey];
    const execute = (subTools as any)[executeKey];

    if (schema && execute) {
      tools[name] = {
        name,
        label: name,
        description: `${name} tool`,
        parameters: schema,
        execute,
        // Mark as dangerous if it's in the dangerous list
        dangerous: DANGEROUS_TOOLS.has(name),
        // Default safeExecute to false (most tools use bash -c currently)
        safeExecute: false,
      };
    }
  }

  toolCache.set(cwd, tools);
  return tools;
}

/**
 * Clear tool cache (useful for testing or when tools change)
 */
export function clearToolCache(): void {
  toolCache.clear();
}

/**
 * Get list of available sub-tool names (excluding core tools)
 */
export function getAvailableSubToolNames(): SubToolName[] {
  return subToolNames.filter(name => !coreToolNames.has(name)) as SubToolName[];
}

/**
 * Get schema for a specific sub-tool
 */
export function getSubToolSchema(name: SubToolName): any | undefined {
  const schemaKey = `${name}Schema`;
  return (subTools as any)[schemaKey];
}

/**
 * Get execute function for a specific sub-tool
 */
export function getSubToolExecutor(name: SubToolName): any | undefined {
  const executeKey = `execute${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return (subTools as any)[executeKey];
}