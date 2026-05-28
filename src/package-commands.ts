#!/usr/bin/env node

/**
 * Piclaw Package Commands
 *
 * CLI for package management using PiclawPackageManager.
 */

import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getAgentDir } from "./config/config-manager.js";
import { PiclawPackageManager } from "./piclaw-package-manager.js";

/**
 * Handle package install command
 * Usage: piclaw install <source> [-l]
 */
export async function handleInstallCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "install") return false;

  let local = false;
  let dryRun = false;
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
  git:<repo>         Install from git (e.g., git:github.com/user/repo, git:https://...)
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
  const agentDir = getAgentDir();

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    await pm.installAndPersist(source, { local, dryRun });
    if (dryRun) {
      console.log(chalk.yellow(`[DRY-RUN] Simulated install of ${source}`));
    } else {
      console.log(chalk.green(`✓ Installed ${source}`));
    }
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
  let dryRun = false;
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
  const agentDir = getAgentDir();

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    await pm.removeAndPersist(source, { local, dryRun });
    if (dryRun) {
      console.log(chalk.yellow(`[DRY-RUN] Simulated removal of ${source}`));
    } else {
      console.log(chalk.green(`✓ Removed ${source}`));
    }
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
  const agentDir = getAgentDir();

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    const configuredPackages = pm.listConfiguredPackages();

    const globalPkgs = configuredPackages.filter((p) => p.scope === "user");
    const projectPkgs = configuredPackages.filter((p) => p.scope === "project");

    if (configuredPackages.length === 0) {
      console.log(chalk.dim("No packages installed."));
      return true;
    }

    if (globalPkgs.length > 0) {
      console.log(chalk.bold("Global packages:"));
      for (const pkg of globalPkgs) {
        const display = pkg.filtered ? `${pkg.source} (filtered)` : pkg.source;
        console.log(`  ${display}`);
        if (pkg.installedPath) {
          console.log(chalk.dim(`    ${pkg.installedPath}`));
        }
      }
    }

    if (projectPkgs.length > 0) {
      if (globalPkgs.length > 0) console.log();
      console.log(chalk.bold("Project packages:"));
      for (const pkg of projectPkgs) {
        const display = pkg.filtered ? `${pkg.source} (filtered)` : pkg.source;
        console.log(`  ${display}`);
        if (pkg.installedPath) {
          console.log(chalk.dim(`    ${pkg.installedPath}`));
        }
      }
    }

    return true;
  } catch (err: any) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Handle package update command
 * Usage: piclaw update [source] [-l]
 */
export async function handleUpdateCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "update") return false;

  let local = false;
  let dryRun = false;
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
        console.error(chalk.dim(`Usage: piclaw update [source] [-l]`));
        process.exit(1);
      }
      source = args[i];
    } else {
      console.error(chalk.red(`Unknown option: ${args[i]}`));
      console.error(chalk.dim(`Usage: piclaw update [source] [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    console.log(`
Usage: piclaw update [source] [-l]

Update installed packages to latest version.

Arguments:
  [source]            Update a specific package (e.g., npm:foo, git:bar)

Options:
  -l, --local         Update project-local packages (.piclaw/settings.json)
  -h, --help          Show this help

Examples:
  piclaw update                   # Update all packages
  piclaw update npm:chalk         # Update specific npm package
  piclaw update git:my/repo -l    # Update local git package
`);
    return true;
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    await pm.update(source, { local, dryRun });
    return true;
  } catch (err: any) {
    console.error(chalk.red(`✗ Failed: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Handle package info command
 * Usage: piclaw info <source> [-l]
 */
export async function handleInfoCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "info") return false;

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
        console.error(chalk.dim(`Usage: piclaw info <source> [-l]`));
        process.exit(1);
      }
      source = args[i];
    } else {
      console.error(chalk.red(`Unknown option: ${args[i]}`));
      console.error(chalk.dim(`Usage: piclaw info <source> [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    console.log(`
Usage: piclaw info <source> [-l]

Show details about an installed package.

Arguments:
  <source>            Package source (e.g., npm:foo, git:bar)

Options:
  -l, --local         Look in project settings (.piclaw/settings.json)
  -h, --help          Show this help

Examples:
  piclaw info npm:chalk
  piclaw info git:my/repo -l
`);
    return true;
  }

  if (!source) {
    console.error(chalk.red("Missing package source."));
    console.error(chalk.dim(`Usage: piclaw info <source> [-l]`));
    process.exit(1);
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    const configured = pm.listConfiguredPackages();
    const entry = configured.find(p => p.source === source && p.scope === (local ? "project" : "user"));
    if (!entry) {
      console.error(chalk.yellow(`Package '${source}' not found in ${local ? 'project' : 'global'} settings.`));
      return true; // not an error
    }

    console.log(chalk.bold(`Source: ${entry.source}`));
    console.log(`Scope: ${entry.scope}`);
    console.log(`Filtered: ${entry.filtered ? "yes" : "no"}`);
    if (entry.installedPath) {
      console.log(`Installed path: ${entry.installedPath}`);
    } else {
      console.log(chalk.yellow(`Installed path: not found`));
    }

    const resolved = await pm.resolveExtensionSources([source], { local });
    console.log(`Extensions: ${resolved.extensions.length}`);
    console.log(`Skills: ${resolved.skills.length}`);
    console.log(`Prompts: ${resolved.prompts.length}`);
    console.log(`Themes: ${resolved.themes.length}`);

    return true;
  } catch (err: any) {
    console.error(chalk.red(`✗ Failed: ${err.message}`));
    process.exit(1);
  }
}

export async function handleHealthCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "health") return false;

  const cwd = process.cwd();
  const agentDir = getAgentDir();

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    const configured = pm.listConfiguredPackages();

    if (configured.length === 0) {
      console.log(chalk.dim("No packages configured."));
      return true;
    }

    let healthy = 0;
    let issues = 0;

    for (const pkg of configured) {
      if (!pkg.installedPath) {
        console.log(chalk.yellow(`${pkg.source} (${pkg.scope}): not installed`));
        issues++;
        continue;
      }

      const pkgJsonPath = join(pkg.installedPath, "package.json");
      if (!existsSync(pkgJsonPath)) {
        console.log(chalk.yellow(`${pkg.source}: missing package.json`));
        issues++;
        continue;
      }

      try {
        const content = readFileSync(pkgJsonPath, "utf-8");
        JSON.parse(content);
        console.log(chalk.green(`${pkg.source}: OK`));
        healthy++;
      } catch (e) {
        console.log(chalk.red(`${pkg.source}: invalid package.json`));
        issues++;
      }
    }

    console.log();
    console.log(chalk.bold(`Health check complete: ${healthy} healthy, ${issues} issues`));
    return true;
  } catch (err: any) {
    console.error(chalk.red(`✗ Failed: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Handle package pin command
 * Usage: piclaw pin <oldSource> <newSource> [-l]
 */
export async function handlePinCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "pin") return false;

  let local = false;
  let help = false;
  let oldSource: string | undefined;
  let newSource: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "-l" || args[i] === "--local") {
      local = true;
    } else if (args[i] === "-h" || args[i] === "--help") {
      help = true;
    } else if (!args[i].startsWith("-")) {
      if (!oldSource) {
        oldSource = args[i];
      } else if (!newSource) {
        newSource = args[i];
      } else {
        console.error(chalk.red(`Unexpected argument: ${args[i]}`));
        console.error(chalk.dim(`Usage: piclaw pin <oldSource> <newSource> [-l]`));
        process.exit(1);
      }
    } else {
      console.error(chalk.red(`Unknown option: ${args[i]}`));
      console.error(chalk.dim(`Usage: piclaw pin <oldSource> <newSource> [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    console.log(`
Usage: piclaw pin <oldSource> <newSource> [-l]

Update a package source in settings (e.g., change pinned version).

Arguments:
  <oldSource>         Current package source (e.g., npm:foo@1.0)
  <newSource>         New package source (e.g., npm:foo@1.2)

Options:
  -l, --local         Operate on project settings (.piclaw/settings.json)
  -h, --help          Show this help

Example:
  piclaw pin npm:chalk@1.0 npm:chalk@1.2
`);
    return true;
  }

  if (!oldSource || !newSource) {
    console.error(chalk.red("Missing arguments. Usage: piclaw pin <oldSource> <newSource> [-l]"));
    process.exit(1);
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const scope = local ? "project" : "user";
  const settingsPath = scope === "project"
    ? join(cwd, ".piclaw", "settings.json")
    : join(agentDir, "settings.json");

  if (!existsSync(settingsPath)) {
    console.error(chalk.red(`Settings file not found: ${settingsPath}`));
    process.exit(1);
  }

  try {
    const raw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);

    if (!Array.isArray(settings.packages)) {
      console.error(chalk.red("Invalid settings: packages array missing"));
      process.exit(1);
    }

    const idx = settings.packages.findIndex(
      (p: any) => (typeof p === "string" ? p : p.source) === oldSource
    );
    if (idx === -1) {
      console.error(chalk.red(`Old source not found in settings: ${oldSource}`));
      process.exit(1);
    }

    settings.packages[idx] = newSource;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    console.log(chalk.green(`✓ Pinned ${oldSource} -> ${newSource}`));
    return true;
  } catch (err: any) {
    console.error(chalk.red(`✗ Failed: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Handle package export command
 * Usage: piclaw export [output.json] [-l]
 */
export async function handleExportCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "export") return false;

  let local = false;
  let help = false;
  let outputFile: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "-l" || args[i] === "--local") {
      local = true;
    } else if (args[i] === "-h" || args[i] === "--help") {
      help = true;
    } else if (!args[i].startsWith("-")) {
      if (!outputFile) {
        outputFile = args[i];
      } else {
        console.error(chalk.red(`Unexpected argument: ${args[i]}`));
        console.error(chalk.dim(`Usage: piclaw export [output.json] [-l]`));
        process.exit(1);
      }
    } else {
      console.error(chalk.red(`Unknown option: ${args[i]}`));
      console.error(chalk.dim(`Usage: piclaw export [output.json] [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    console.log(`
Usage: piclaw export [output.json] [-l]

Export configured packages to a JSON file.

Arguments:
  [output.json]      Optional output file (defaults to stdout if omitted)

Options:
  -l, --local         Export from project settings (.piclaw/settings.json)
  -h, --help          Show this help

Examples:
  piclaw export -l > packages.json
  piclaw export backup.json
`);
    return true;
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const scope = local ? "project" : "user";
  const settingsPath = scope === "project"
    ? join(cwd, ".piclaw", "settings.json")
    : join(agentDir, "settings.json");

  try {
    if (!existsSync(settingsPath)) {
      console.error(chalk.yellow(`No settings file found at ${settingsPath}.`));
      return true; // not an error
    }

    const raw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const packages = settings.packages || [];
    const json = JSON.stringify(packages, null, 2) + "\n";

    if (outputFile) {
      writeFileSync(outputFile, json, "utf-8");
      console.log(chalk.green(`✓ Exported ${packages.length} packages to ${outputFile}`));
    } else {
      process.stdout.write(json);
      console.log(chalk.green(`✓ Exported ${packages.length} packages`));
    }
    return true;
  } catch (err: any) {
    console.error(chalk.red(`✗ Failed: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Handle package import command
 * Usage: piclaw import <input.json> [-l]
 */
export async function handleImportCommand(args: string[]): Promise<boolean> {
  if (args[0] !== "import") return false;

  let local = false;
  let help = false;
  let inputFile: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "-l" || args[i] === "--local") {
      local = true;
    } else if (args[i] === "-h" || args[i] === "--help") {
      help = true;
    } else if (!args[i].startsWith("-")) {
      if (!inputFile) {
        inputFile = args[i];
      } else {
        console.error(chalk.red(`Unexpected argument: ${args[i]}`));
        console.error(chalk.dim(`Usage: piclaw import <input.json> [-l]`));
        process.exit(1);
      }
    } else {
      console.error(chalk.red(`Unknown option: ${args[i]}`));
      console.error(chalk.dim(`Usage: piclaw import <input.json> [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    console.log(`
Usage: piclaw import <input.json> [-l]

Import packages from a JSON file.

Arguments:
  <input.json>       Input file containing array of package sources

Options:
  -l, --local         Import into project settings (.piclaw/settings.json)
  -h, --help          Show this help

Examples:
  piclaw import packages.json -l
  cat packages.json | piclaw import -
`);
    return true;
  }

  if (!inputFile) {
    console.error(chalk.red("Missing input file. Usage: piclaw import <input.json> [-l]"));
    process.exit(1);
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const scope = local ? "project" : "user";
  const settingsPath = scope === "project"
    ? join(cwd, ".piclaw", "settings.json")
    : join(agentDir, "settings.json");

  try {
    let content: string;
    if (inputFile === "-") {
      // Read from stdin
      content = await new Promise((resolve, reject) => {
        let data = "";
        process.stdin.setEncoding("utf-8");
        process.stdin.on("data", chunk => data += chunk);
        process.stdin.on("end", () => resolve(data));
        process.stdin.on("error", reject);
        // If stdin is not piped, it may be empty; handle quickly
        if (process.stdin.isTTY) {
          resolve("");
        }
      });
    } else {
      if (!existsSync(inputFile)) {
        console.error(chalk.red(`Input file not found: ${inputFile}`));
        process.exit(1);
      }
      content = readFileSync(inputFile, "utf-8");
    }

    if (!content.trim()) {
      console.error(chalk.red("Empty input."));
      process.exit(1);
    }

    let packages: any[];
    try {
      packages = JSON.parse(content);
    } catch (e) {
      console.error(chalk.red("Invalid JSON in input file."));
      process.exit(1);
    }

    if (!Array.isArray(packages)) {
      console.error(chalk.red("Expected an array of package sources in the JSON."));
      process.exit(1);
    }

    // Load existing settings
    const existing = existsSync(settingsPath)
      ? JSON.parse(readFileSync(settingsPath, "utf-8"))
      : { packages: [] };
    if (!Array.isArray(existing.packages)) existing.packages = [];

    let added = 0;
    for (const pkg of packages) {
      // Normalize to string
      const source = typeof pkg === "string" ? pkg : pkg.source;
      if (!source) continue;
      // Check duplicate
      const exists = existing.packages.some(p => (typeof p === "string" ? p : p.source) === source);
      if (!exists) {
        existing.packages.push(pkg);
        added++;
      }
    }

    // Ensure settings directory exists
    const dir = dirname(settingsPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
    console.log(chalk.green(`✓ Imported ${added} new packages (total ${existing.packages.length})`));
    return true;
  } catch (err: any) {
    console.error(chalk.red(`✗ Failed: ${err.message}`));
    process.exit(1);
  }
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
    case "update":
      await handleUpdateCommand(args);
      return true;
    case "info":
      await handleInfoCommand(args);
      return true;
    case "health":
      await handleHealthCommand(args);
      return true;
    case "pin":
      await handlePinCommand(args);
      return true;
    case "export":
      await handleExportCommand(args);
      return true;
    case "import":
      await handleImportCommand(args);
      return true;
    default:
      return false;
  }
}
