#!/usr/bin/env node

/**
 * Piclaw Package Commands
 *
 * Simple package manager using .piclaw directory.
 * Supports: install, remove, list
 */

import chalk from "chalk";
import { spawn, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config paths for piclaw
function getConfigDir(): string {
  return join(homedir(), ".piclaw");
}

function getGlobalSettingsPath(): string {
  return join(getConfigDir(), "settings.json");
}

function getProjectSettingsPath(cwd: string): string {
  return join(cwd, ".piclaw", "settings.json");
}

function getProjectNpmRoot(cwd: string): string {
  return join(cwd, ".piclaw", "npm");
}

function getGlobalNpmRoot(): string {
  // Use npm's global root
  try {
    const result = spawnSync("npm", ["root", "-g"], { encoding: "utf-8" });
    if (result.status === 0) {
      return result.stdout.trim();
    }
  } catch (err: any) {
    // ignore
  }
  // Fallback
  return join(homedir(), ".npm", "global", "node_modules");
}

interface PiclawSettings {
  packages?: string[];
}

function loadSettings(path: string): PiclawSettings {
  if (existsSync(path)) {
    try {
      const content = readFileSync(path, "utf-8");
      return JSON.parse(content);
    } catch (err: any) {
      console.warn(chalk.yellow(`Failed to parse settings at ${path}: ${err.message}`));
    }
  }
  return {};
}

function saveSettings(path: string, settings: PiclawSettings): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(settings, null, 2), "utf-8");
}

function runNpmCommand(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm exited with code ${code}`));
      }
    });
    child.on("error", (err: any) => reject(err));
  });
}

/**
 * Handle package install command
 * Usage: piclaw install <source> [-l]
 */
export async function handleInstallCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "install") return false;

  let local = false;
  let source: string | undefined;
  let help = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "-l" || args[i] === "--local") {
      local = true;
    } else if (args[i] === "-h" || args[i] === "--help") {
      help = true;
    } else if (!args[i].startsWith("-")) {
      if (source) {
        console.error(chalk.red(`Unexpected argument: ${args[i]}`));
        console.error(chalk.dim(`Usage: piclaw install <source> [-l]`));
        process.exit(1);
      }
      source = args[i];
    } else {
      console.error(chalk.red(`Unknown option: ${args[i]}`));
      console.error(chalk.dim(`Usage: piclaw install <source> [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    console.log(`
Usage: piclaw install <source> [-l]

Install a pi package and add it to settings.

Sources:
  npm:<package>      Install from npm (e.g., npm:foo/bar, npm:@scope/bar@1.2.3)
  git:<repo>         Install from git (e.g., git:github.com/user/repo)
  <path>             Install from local path (absolute or relative)

Options:
  -l, --local        Install to project settings (.piclaw/settings.json)
  -h, --help         Show this help

Examples:
  piclaw install npm:foo/bar
  piclaw install npm:@my/pi-tools@1.2.3
  piclaw install git:github.com/user/repo
  piclaw install ./local/package -l
`);
    return true;
  }

  if (!source) {
    console.error(chalk.red("Missing install source."));
    console.error(chalk.dim(`Usage: piclaw install <source> [-l]`));
    process.exit(1);
  }

  const cwd = process.cwd();

  try {
    // Parse source spec
    let npmSpec: string | null = null;
    if (source.startsWith("npm:")) {
      npmSpec = source.slice(4);
    } else if (source.startsWith("git:") || source.startsWith("https:") || source.startsWith("ssh:") || source.startsWith("git@")) {
      console.error(chalk.red("Git sources not yet supported in simple manager"));
      process.exit(1);
    } else if (!source.includes("/") && !source.startsWith(".") && !source.startsWith("/")) {
      // Assume npm package without prefix
      npmSpec = source;
    } else {
      // Local path - just ensure it exists and add to settings
      const resolved = resolve(cwd, source);
      if (!existsSync(resolved)) {
        console.error(chalk.red(`Path does not exist: ${resolved}`));
        process.exit(1);
      }
      // Add to settings without npm install
      const settingsPath = local ? getProjectSettingsPath(cwd) : getGlobalSettingsPath();
      const settings = loadSettings(settingsPath);
      if (!settings.packages) settings.packages = [];
      const normalized = local ? source : resolve(source);
      if (!settings.packages.includes(normalized)) {
        settings.packages.push(normalized);
        saveSettings(settingsPath, settings);
      }
      console.log(chalk.green(`✓ Added ${normalized}`));
      return true;
    }

    if (!npmSpec) {
      console.error(chalk.red("Invalid source format"));
      process.exit(1);
    }

    // Ensure npm root exists for local installs
    if (local) {
      const npmRoot = getProjectNpmRoot(cwd);
      if (!existsSync(npmRoot)) {
        mkdirSync(npmRoot, { recursive: true });
      }
      // Run npm install into .piclaw/npm
      await runNpmCommand(["install", npmSpec, "--prefix", npmRoot, "--no-audit", "--no-fund"]);
    } else {
      // Global install (uses npm's global node_modules)
      await runNpmCommand(["install", "-g", npmSpec, "--no-audit", "--no-fund"]);
    }

    // Add to settings
    const settingsPath = local ? getProjectSettingsPath(cwd) : getGlobalSettingsPath();
    const settings = loadSettings(settingsPath);
    if (!settings.packages) settings.packages = [];
    const entry = source.startsWith("npm:") ? source : `npm:${source}`;
    if (!settings.packages.includes(entry)) {
      settings.packages.push(entry);
      saveSettings(settingsPath, settings);
    }

    console.log(chalk.green(`✓ Installed ${source}`));
    return true;
  } catch (err: any) {
    console.error(chalk.red(`✗ Failed: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Handle package remove command
 * Usage: piclaw remove <source> [-l]
 */
export async function handleRemoveCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "remove" && args[0] !== "uninstall") return false;

  let local = false;
  let source: string | undefined;
  let help = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "-l" || args[i] === "--local") {
      local = true;
    } else if (args[i] === "-h" || args[i] === "--help") {
      help = true;
    } else if (!args[i].startsWith("-")) {
      if (source) {
        console.error(chalk.red(`Unexpected argument: ${args[i]}`));
        console.error(chalk.dim(`Usage: piclaw remove <source> [-l]`));
        process.exit(1);
      }
      source = args[i];
    } else {
      console.error(chalk.red(`Unknown option: ${args[i]}`));
      console.error(chalk.dim(`Usage: piclaw remove <source> [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    console.log(`
Usage: piclaw remove <source> [-l]

Remove a package and its source from settings.

Options:
  -l, --local        Remove from project settings (.piclaw/settings.json)
  -h, --help         Show this help

Examples:
  piclaw remove npm:foo/bar
  piclaw remove git:github.com/user/repo
`);
    return true;
  }

  if (!source) {
    console.error(chalk.red("Missing remove source."));
    console.error(chalk.dim(`Usage: piclaw remove <source> [-l]`));
    process.exit(1);
  }

  const cwd = process.cwd();

  try {
    // Normalize source entry
    const entry = source.startsWith("npm:") || source.startsWith("git:") || source.startsWith("https:") ? source : `npm:${source}`;

    // Remove from settings first
    const settingsPath = local ? getProjectSettingsPath(cwd) : getGlobalSettingsPath();
    if (!existsSync(settingsPath)) {
      console.error(chalk.red(`Settings not found: ${settingsPath}`));
      process.exit(1);
    }
    const settings = loadSettings(settingsPath);
    if (!settings.packages || !settings.packages.includes(entry)) {
      console.error(chalk.red(`Package not found in settings: ${entry}`));
      process.exit(1);
    }
    settings.packages = settings.packages.filter((p) => p !== entry);
    saveSettings(settingsPath, settings);

    // Uninstall npm package if it's npm
    if (entry.startsWith("npm:")) {
      const npmSpec = entry.slice(4);
      if (local) {
        const npmRoot = getProjectNpmRoot(cwd);
        await runNpmCommand(["uninstall", npmSpec, "--prefix", npmRoot]);
      } else {
        await runNpmCommand(["uninstall", "-g", npmSpec]);
      }
    }

    console.log(chalk.green(`✓ Removed ${entry}`));
    return true;
  } catch (err: any) {
    console.error(chalk.red(`✗ Failed: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Handle package list command
 * Usage: piclaw list
 */
export async function handleListCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "list") return false;

  if (args.length > 1 && !["-h", "--help"].includes(args[1])) {
    console.error(chalk.red("Unexpected arguments"));
    console.error(chalk.dim(`Usage: piclaw list`));
    process.exit(1);
  }

  if (args.includes("-h") || args.includes("--help")) {
    console.log(`
Usage: piclaw list

List installed packages from user and project settings.
`);
    return true;
  }

  const cwd = process.cwd();
  const globalPath = getGlobalSettingsPath();
  const projectPath = getProjectSettingsPath(cwd);

  const globalSettings = existsSync(globalPath) ? loadSettings(globalPath) : {};
  const projectSettings = existsSync(projectPath) ? loadSettings(projectPath) : {};

  const globalPkgs = globalSettings.packages || [];
  const projectPkgs = projectSettings.packages || [];

  if (globalPkgs.length === 0 && projectPkgs.length === 0) {
    console.log(chalk.dim("No packages installed."));
    return true;
  }

  if (globalPkgs.length > 0) {
    console.log(chalk.bold("Global packages:"));
    for (const pkg of globalPkgs) {
      console.log(`  ${pkg}`);
    }
  }

  if (projectPkgs.length > 0) {
    if (globalPkgs.length > 0) console.log();
    console.log(chalk.bold("Project packages:"));
    for (const pkg of projectPkgs) {
      console.log(`  ${pkg}`);
    }
  }

  return true;
}

/**
 * Handle all package commands
 * Called from main.ts
 */
export async function handlePackageCommand(args: string[]): Promise<boolean> {
  if (args.length === 0) return false;

  const command = args[0];

  switch (command) {
    case "install":
      await handleInstallCommand(args);
      return true;
    case "remove":
    case "uninstall":
      await handleRemoveCommand(args);
      return true;
    case "list":
      await handleListCommand(args);
      return true;
    default:
      return false;
  }
}
