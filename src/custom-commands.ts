#!/usr/bin/env node
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { getAgentDir, CONFIG_DIR_NAME } from "./config/config-manager.js";
import { PiclawPackageManager } from "./piclaw-package-manager.js";
import { logger } from "./utils/logger.js";

// ============ handlePinCommand ============
export async function handlePinCommand(args: string[]): Promise<void> {
  if (args[0] !== "pin") return;

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
        logger.error(chalk.red(`Unexpected argument: ${args[i]}`));
        logger.error(chalk.dim(`Usage: piclaw pin <oldSource> <newSource> [-l]`));
        process.exit(1);
      }
    } else {
      logger.error(chalk.red(`Unknown option: ${args[i]}`));
      logger.error(chalk.dim(`Usage: piclaw pin <oldSource> <newSource> [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    logger.log(`
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
    return;
  }

  if (!oldSource || !newSource) {
    logger.error(chalk.red("Missing arguments. Usage: piclaw pin <oldSource> <newSource> [-l]"));
    process.exit(1);
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const scope = local ? "project" : "user";
  const settingsPath = scope === "project"
    ? join(cwd, CONFIG_DIR_NAME, "settings.json")
    : join(agentDir, "settings.json");

  if (!existsSync(settingsPath)) {
    logger.error(chalk.red(`Settings file not found: ${settingsPath}`));
    process.exit(1);
  }

  try {
    const raw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);

    if (!Array.isArray(settings.packages)) {
      logger.error(chalk.red("Invalid settings: packages array missing"));
      process.exit(1);
    }

    const idx = settings.packages.findIndex(
      (p: unknown): boolean => {
        if (typeof p === "string") return p === oldSource;
        if (typeof p === "object" && p !== null && "source" in p) return (p as any).source === oldSource;
        return false;
      }
    );
    if (idx === -1) {
      logger.error(chalk.red(`Old source not found in settings: ${oldSource}`));
      process.exit(1);
    }

    settings.packages[idx] = newSource;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    logger.log(chalk.green(`✓ Pinned ${oldSource} -> ${newSource}`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(chalk.red(`✗ Failed: ${msg}`));
    process.exit(1);
  }
}

// ============ handleExportCommand ============
export async function handleExportCommand(args: string[]): Promise<void> {
  if (args[0] !== "export") return;

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
        logger.error(chalk.red(`Unexpected argument: ${args[i]}`));
        logger.error(chalk.dim(`Usage: piclaw export [output.json] [-l]`));
        process.exit(1);
      }
    } else {
      logger.error(chalk.red(`Unknown option: ${args[i]}`));
      logger.error(chalk.dim(`Usage: piclaw export [output.json] [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    logger.log(`
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
    return;
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const scope = local ? "project" : "user";
  const settingsPath = scope === "project"
    ? join(cwd, CONFIG_DIR_NAME, "settings.json")
    : join(agentDir, "settings.json");

  try {
    if (!existsSync(settingsPath)) {
      logger.error(chalk.yellow(`No settings file found at ${settingsPath}.`));
      return; // not an error
    }

    const raw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const packages = settings.packages || [];
    const json = JSON.stringify(packages, null, 2) + "\n";

    if (outputFile) {
      writeFileSync(outputFile, json, "utf-8");
      logger.log(chalk.green(`✓ Exported ${packages.length} packages to ${outputFile}`));
    } else {
      process.stdout.write(json);
      logger.log(chalk.green(`✓ Exported ${packages.length} packages`));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(chalk.red(`✗ Failed: ${msg}`));
    process.exit(1);
  }
}

// ============ handleImportCommand ============
export async function handleImportCommand(args: string[]): Promise<void> {
  if (args[0] !== "import") return;

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
        logger.error(chalk.red(`Unexpected argument: ${args[i]}`));
        logger.error(chalk.dim(`Usage: piclaw import <input.json> [-l]`));
        process.exit(1);
      }
    } else {
      logger.error(chalk.red(`Unknown option: ${args[i]}`));
      logger.error(chalk.dim(`Usage: piclaw import <input.json> [-l]`));
      process.exit(1);
    }
  }

  if (help) {
    logger.log(`
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
    return;
  }

  if (!inputFile) {
    logger.error(chalk.red("Missing input file. Usage: piclaw import <input.json> [-l]"));
    process.exit(1);
  }

  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const scope = local ? "project" : "user";
  const settingsPath = scope === "project"
    ? join(cwd, CONFIG_DIR_NAME, "settings.json")
    : join(agentDir, "settings.json");

  try {
    let content: string;
    if (inputFile === "-") {
      content = await new Promise((resolve, reject) => {
        let data = "";
        process.stdin.setEncoding("utf-8");
        process.stdin.on("data", chunk => data += chunk);
        process.stdin.on("end", () => resolve(data));
        process.stdin.on("error", reject);
        if (process.stdin.isTTY) {
          resolve("");
        }
      });
    } else {
      if (!existsSync(inputFile)) {
        logger.error(chalk.red(`Input file not found: ${inputFile}`));
        process.exit(1);
      }
      content = readFileSync(inputFile, "utf-8");
    }

    if (!content.trim()) {
      logger.error(chalk.red("Empty input."));
      process.exit(1);
    }

    let packages: any[];
    try {
      packages = JSON.parse(content);
    } catch (e) {
      logger.error(chalk.red("Invalid JSON in input file."));
      process.exit(1);
    }

    if (!Array.isArray(packages)) {
      logger.error(chalk.red("Expected an array of package sources in the JSON."));
      process.exit(1);
    }

    const existing: any = existsSync(settingsPath)
      ? JSON.parse(readFileSync(settingsPath, "utf-8"))
      : { packages: [] };
    if (!Array.isArray(existing.packages)) existing.packages = [];

    let added = 0;
    for (const pkg of packages) {
      const source = typeof pkg === "string" ? pkg : pkg.source;
      if (!source) continue;
      // @ts-ignore - packages can be string or {source}
    const exists = existing.packages.some((p: unknown): boolean => {
      if (typeof p === "string") return p === source;
      if (typeof p === "object" && p !== null && "source" in p) return p.source === source;
      return false;
    });
      if (!exists) {
        existing.packages.push(pkg);
        added++;
      }
    }

    const dir = dirname(settingsPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
    logger.log(chalk.green(`✓ Imported ${added} new packages (total ${existing.packages.length})`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(chalk.red(`✗ Failed: ${msg}`));
    process.exit(1);
  }
}

// ============ handleHealthCommand ============
export async function handleHealthCommand(args: string[]): Promise<void> {
  if (args[0] !== "health") return;

  const cwd = process.cwd();
  const agentDir = getAgentDir();

  try {
    const pm = new PiclawPackageManager({ cwd, agentDir });
    const configured = pm.listConfiguredPackages();

    if (configured.length === 0) {
      logger.log(chalk.dim("No packages configured."));
      return;
    }

    let healthy = 0;
    let issues = 0;

    for (const pkg of configured) {
      if (!pkg.installedPath) {
        logger.log(chalk.yellow(`${pkg.source} (${pkg.scope}): not installed`));
        issues++;
        continue;
      }

      const pkgJsonPath = join(pkg.installedPath, "package.json");
      if (!existsSync(pkgJsonPath)) {
        logger.log(chalk.yellow(`${pkg.source}: missing package.json`));
        issues++;
        continue;
      }

      try {
        const content = readFileSync(pkgJsonPath, "utf-8");
        JSON.parse(content);
        logger.log(chalk.green(`${pkg.source}: OK`));
        healthy++;
      } catch (e) {
        logger.log(chalk.red(`${pkg.source}: invalid package.json`));
        issues++;
      }
    }

    logger.log("");
    logger.log(chalk.bold(`Health check complete: ${healthy} healthy, ${issues} issues`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(chalk.red(`✗ Failed: ${msg}`));
    process.exit(1);
  }
}

// ============ handleCustomCommands ============
export async function handleCustomCommands(args: string[]): Promise<boolean> {
  const command = args[0];
  switch (command) {
    case "pin":
      await handlePinCommand(args);
      return true;
    case "export":
      await handleExportCommand(args);
      return true;
    case "import":
      await handleImportCommand(args);
      return true;
    case "health":
      await handleHealthCommand(args);
      return true;
    default:
      return false;
  }
}
