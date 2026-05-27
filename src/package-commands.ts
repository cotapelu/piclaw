#!/usr/bin/env node

/**
 * Piclaw Package Commands
 *
 * CLI for package management using PiclawPackageManager.
 */

import chalk from "chalk";
import { join, resolve } from "node:path";
import { PiclawPackageManager } from "./piclaw-package-manager.js";

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
  const agentDir = join(resolve(cwd), ".piclaw", "agent"); // fallback for global paths

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    await pm.installAndPersist(source, { local });
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
  const agentDir = join(resolve(cwd), ".piclaw", "agent");

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    await pm.removeAndPersist(source, { local });
    console.log(chalk.green(`✓ Removed ${source}`));
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
  const agentDir = join(resolve(cwd), ".piclaw", "agent");

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
