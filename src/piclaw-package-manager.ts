#!/usr/bin/env node

/**
 * Piclaw Package Manager (Simplified)
 *
 * Minimal implementation for install/remove/list and resource resolution.
 * Uses .piclaw directory.
 */

import { spawn, spawnSync } from "child_process";
import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { minimatch } from "minimatch";

interface PiclawSettings {
  packages?: Array<string | { source: string; filter?: PackageFilter }>;
}

interface PathMetadata {
  source: string;
  scope: "user" | "project";
  origin: "package";
  baseDir?: string;
}

interface PackageFilter {
  extensions?: string[];
  skills?: string[];
  prompts?: string[];
  themes?: string[];
}

type ParsedSource =
  | { type: "npm"; name: string; pinned: boolean }
  | { type: "git"; host: string; path: string; ref?: string }
  | { type: "local"; path: string };

interface ResolvedResource {
  path: string;
  enabled: boolean;
  metadata: PathMetadata;
}

interface ResolvedPaths {
  extensions: ResolvedResource[];
  skills: ResolvedResource[];
  prompts: ResolvedResource[];
  themes: ResolvedResource[];
}

interface ProgressEvent {
  type: "start" | "progress" | "complete" | "error";
  action: "install" | "remove" | "update" | "clone" | "pull";
  source: string;
  message?: string;
}
type ProgressCallback = (event: ProgressEvent) => void;

// ============================================================================

const RESOURCE_TYPES = ["extensions", "skills", "prompts", "themes"] as const;
type ResourceType = typeof RESOURCE_TYPES[number];

const FILE_PATTERNS: Record<ResourceType, RegExp> = {
  extensions: /\.(ts|js)$/,
  skills: /\.md$/,
  prompts: /\.md$/,
  themes: /\.json$/,
};

function toPosixPath(p: string): string {
  return p.split(sep).join("/");
}

function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (minimatch(filePath, pattern, { matchBase: true, dot: true })) {
      return true;
    }
  }
  return false;
}

function getHomeDir(): string {
  return process.env.HOME || homedir();
}

// ============================================================================

interface ResourceAccumulator {
  extensions: Map<string, { path: string; metadata: PathMetadata; enabled: boolean }>;
  skills: Map<string, { path: string; metadata: PathMetadata; enabled: boolean }>;
  prompts: Map<string, { path: string; metadata: PathMetadata; enabled: boolean }>;
  themes: Map<string, { path: string; metadata: PathMetadata; enabled: boolean }>;
}

// ============================================================================

export class PiclawPackageManager {
  private cwd: string;
  private agentDir: string;
  private progressCallback: ProgressCallback | undefined;

  constructor(options: { cwd: string; agentDir: string }) {
    this.cwd = options.cwd;
    this.agentDir = options.agentDir;
  }

  setProgressCallback(callback: ProgressCallback | undefined): void {
    this.progressCallback = callback;
  }

  private emitProgress(event: ProgressEvent): void {
    this.progressCallback?.(event);
  }

  private async withProgress(
    action: ProgressEvent["action"],
    source: string,
    message: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    this.emitProgress({ type: "start", action, source, message });
    try {
      await operation();
      this.emitProgress({ type: "complete", action, source });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emitProgress({ type: "error", action, source, message: errorMessage });
      throw error;
    }
  }

  // ============================================================================
  // Settings
  // ============================================================================

  private getProjectSettingsPath(): string {
    return join(this.cwd, ".piclaw", "settings.json");
  }

  private getGlobalSettingsPath(): string {
    return join(this.agentDir, "settings.json");
  }

  private loadSettings(path: string): PiclawSettings {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, "utf-8"));
      } catch {
        return { packages: [] };
      }
    }
    return { packages: [] };
  }

  private saveSettings(path: string, settings: PiclawSettings): void {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(settings, null, 2), "utf-8");
  }

  addSourceToSettings(source: string | { source: string; filter?: PackageFilter }, options?: { local?: boolean }): boolean {
    const scope = options?.local ? "project" : "user";
    const path = scope === "project" ? this.getProjectSettingsPath() : this.getGlobalSettingsPath();
    const settings = this.loadSettings(path);
    if (!settings.packages) settings.packages = [];
    // Check duplicate by source string
    const sourceStr = typeof source === "string" ? source : source.source;
    const exists = settings.packages.some(p => (typeof p === "string" ? p : p.source) === sourceStr);
    if (!exists) {
      settings.packages.push(source);
      this.saveSettings(path, settings);
      return true;
    }
    return false;
  }

  removeSourceFromSettings(source: string, options?: { local?: boolean }): boolean {
    const scope = options?.local ? "project" : "user";
    const path = scope === "project" ? this.getProjectSettingsPath() : this.getGlobalSettingsPath();
    const settings = this.loadSettings(path);
    if (!settings.packages) return false;
    const before = settings.packages.length;
    settings.packages = settings.packages.filter((p) => {
      if (typeof p === "string") return p !== source;
      if (typeof p === "object" && p.source) return p.source !== source;
      return true;
    });
    if (settings.packages.length < before) {
      this.saveSettings(path, settings);
      return true;
    }
    return false;
  }

  // ============================================================================
  // Install/Remove
  // ============================================================================

  getInstalledPath(source: string, scope: "user" | "project"): string | undefined {
    const parsed = this.parseSource(source);
    if (parsed.type === "npm") {
      const path = this.getNpmInstallPath(parsed, scope);
      return existsSync(path) ? path : undefined;
    }
    if (parsed.type === "git") {
      const path = this.getGitInstallPath(parsed, scope);
      return existsSync(path) ? path : undefined;
    }
    if (parsed.type === "local") {
      const baseDir = scope === "project" ? this.cwd : this.agentDir;
      const path = resolve(baseDir, parsed.path);
      return existsSync(path) ? path : undefined;
    }
    return undefined;
  }

  async install(source: string, options?: { local?: boolean; dryRun?: boolean }): Promise<void> {
    const scope = options?.local ? "project" : "user";
    await this.withProgress("install", source, `Installing ${source}...`, async () => {
      const parsed = this.parseSource(source);
      this.validateParsed(parsed);
      if (options?.dryRun) {
        console.log(chalk.yellow(`[DRY-RUN] Would install ${source}`));
        return;
      }
      if (parsed.type === "npm") {
        await this.installNpm(parsed, scope);
        return;
      }
      if (parsed.type === "git") {
        await this.installGit(parsed, scope);
        return;
      }
      if (parsed.type === "local") {
        const resolved = resolve(this.cwd, parsed.path);
        if (!existsSync(resolved)) throw new Error(`Path does not exist: ${resolved}`);
        return;
      }
      throw new Error(`Unsupported install source: ${source}`);
    });
  }

  async installAndPersist(source: string, options?: { local?: boolean; dryRun?: boolean }): Promise<void> {
    await this.install(source, options);
    if (!options?.dryRun) {
      this.addSourceToSettings(source, options);
    } else {
      console.log(chalk.yellow(`[DRY-RUN] Would add ${source} to settings`));
    }
  }

  async remove(source: string, options?: { local?: boolean; dryRun?: boolean }): Promise<void> {
    await this.withProgress("remove", source, `Removing ${source}...`, async () => {
      const parsed = this.parseSource(source);
      if (options?.dryRun) {
        console.log(chalk.yellow(`[DRY-RUN] Would remove ${source}`));
        return;
      }
      if (parsed.type === "npm") {
        await this.uninstallNpm(parsed, options?.local ? "project" : "user");
        return;
      }
      if (parsed.type === "git") {
        await this.uninstallGit(parsed, options?.local ? "project" : "user");
        return;
      }
    });
  }

  async removeAndPersist(source: string, options?: { local?: boolean; dryRun?: boolean }): Promise<boolean> {
    await this.remove(source, options);
    if (!options?.dryRun) {
      return this.removeSourceFromSettings(source, options);
    } else {
      console.log(chalk.yellow(`[DRY-RUN] Would remove ${source} from settings`));
      return true;
    }
  }

  private getConfiguredEntries(): Array<{ source: string; scope: "user" | "project"; filter?: PackageFilter }> {
    const globalSettings = this.loadSettings(this.getGlobalSettingsPath());
    const projectSettings = this.loadSettings(this.getProjectSettingsPath());
    const result: Array<{ source: string; scope: "user" | "project"; filter?: PackageFilter }> = [];

    for (const src of globalSettings.packages || []) {
      if (typeof src === "string") {
        result.push({ source: src, scope: "user" });
      } else if (typeof src === "object" && src.source) {
        result.push({ source: src.source, scope: "user", filter: src.filter });
      }
    }
    for (const src of projectSettings.packages || []) {
      if (typeof src === "string") {
        result.push({ source: src, scope: "project" });
      } else if (typeof src === "object" && src.source) {
        result.push({ source: src.source, scope: "project", filter: src.filter });
      }
    }
    return result;
  }

  listConfiguredPackages(): Array<{ source: string; scope: "user" | "project"; installedPath?: string; filtered: boolean }> {
    const entries = this.getConfiguredEntries();
    return entries.map(entry => ({
      source: entry.source,
      scope: entry.scope,
      installedPath: this.getInstalledPath(entry.source, entry.scope),
      filtered: !!entry.filter,
    }));
  }

  async resolveExtensionSources(
    sources: string[],
    options?: { local?: boolean; temporary?: boolean },
  ): Promise<ResolvedPaths> {
    const accumulator: ResourceAccumulator = {
      extensions: new Map(),
      skills: new Map(),
      prompts: new Map(),
      themes: new Map(),
    };

    for (const source of sources) {
      const parsed = this.parseSource(source);
      const scope: "user" | "project" = options?.local ? "project" : "user";

      if (parsed.type === "npm") {
        const installedPath = this.getNpmInstallPath(parsed, scope);
        if (existsSync(installedPath)) {
          this.collectPackageResources(installedPath, accumulator, undefined, {
            source,
            scope,
            origin: "package",
            baseDir: installedPath,
          });
        }
      } else if (parsed.type === "git") {
        const installedPath = this.getGitInstallPath(parsed, scope);
        if (existsSync(installedPath)) {
          this.collectPackageResources(installedPath, accumulator, undefined, {
            source,
            scope,
            origin: "package",
            baseDir: installedPath,
          });
        }
      } else if (parsed.type === "local") {
        const baseDir = scope === "project" ? this.cwd : this.agentDir;
        const resolved = resolve(baseDir, parsed.path);
        if (existsSync(resolved)) {
          this.collectPackageResources(resolved, accumulator, undefined, {
            source,
            scope,
            origin: "package",
            baseDir: resolved,
          });
        }
      }
    }

    return {
      extensions: Array.from(accumulator.extensions.values()).map((e) => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
      skills: Array.from(accumulator.skills.values()).map((e) => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
      prompts: Array.from(accumulator.prompts.values()).map((e) => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
      themes: Array.from(accumulator.themes.values()).map((e) => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
    };
  }

  async resolve(_onMissing?: (source: string) => Promise<any>): Promise<ResolvedPaths> {
    const entries = this.getConfiguredEntries();
    const accumulator: ResourceAccumulator = {
      extensions: new Map(),
      skills: new Map(),
      prompts: new Map(),
      themes: new Map(),
    };

    for (const entry of entries) {
      const parsed = this.parseSource(entry.source);
      const metadata: PathMetadata = {
        source: entry.source,
        scope: entry.scope,
        origin: "package",
      };

      if (parsed.type === "npm") {
        const installedPath = this.getNpmInstallPath(parsed, entry.scope);
        if (existsSync(installedPath)) {
          metadata.baseDir = installedPath;
          this.collectPackageResources(installedPath, accumulator, entry.filter, metadata);
        }
      } else if (parsed.type === "git") {
        const installedPath = this.getGitInstallPath(parsed, entry.scope);
        if (existsSync(installedPath)) {
          metadata.baseDir = installedPath;
          this.collectPackageResources(installedPath, accumulator, entry.filter, metadata);
        }
      } else if (parsed.type === "local") {
        const base = entry.scope === "project" ? this.cwd : this.agentDir;
        const resolved = resolve(base, parsed.path);
        if (existsSync(resolved)) {
          metadata.baseDir = resolved;
          this.collectPackageResources(resolved, accumulator, entry.filter, metadata);
        }
      }
    }

    return {
      extensions: Array.from(accumulator.extensions.values()).map(e => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
      skills: Array.from(accumulator.skills.values()).map(e => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
      prompts: Array.from(accumulator.prompts.values()).map(e => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
      themes: Array.from(accumulator.themes.values()).map(e => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
    };
  }

  async update(source?: string, options?: { local?: boolean; dryRun?: boolean }): Promise<void> {
    const scope = options?.local ? "project" : "user";
    const settingsPath = scope === "project" ? this.getProjectSettingsPath() : this.getGlobalSettingsPath();
    const settings = this.loadSettings(settingsPath);
    const packages = settings.packages || [];

    // Filter by source if provided
    const targets = source ? packages.filter(p => p === source) : packages;

    if (targets.length === 0) {
      console.log(chalk.gray("No packages to update."));
      return;
    }

    for (const pkg of targets) {
      const parsed = this.parseSource(pkg);
      if (options?.dryRun) {
        console.log(chalk.yellow(`[DRY-RUN] Would update ${pkg}`));
        continue;
      }
      if (parsed.type === "npm") {
        await this.updateNpm(parsed, scope);
      } else if (parsed.type === "git") {
        await this.updateGit(parsed, scope);
      } else {
        console.log(chalk.yellow(`Skipping ${pkg}: unsupported source type`));
      }
    }
  }

  private async updateNpm(source: { type: "npm"; name: string; pinned: boolean }, scope: "user" | "project"): Promise<void> {
    const installedPath = this.getNpmInstallPath(source, scope);
    if (!existsSync(installedPath)) {
      console.log(chalk.yellow(`Skipping ${source.name}: not installed`));
      return;
    }

    // Check if pinned version
    if (source.pinned) {
      console.log(chalk.gray(`Skipping ${source.name}: pinned version`));
      return;
    }

    // Get installed version
    const installedVersion = this.getInstalledNpmVersion(installedPath);
    if (!installedVersion) {
      console.log(chalk.yellow(`Skipping ${source.name}: no version info`));
      return;
    }

    // Get latest version from npm
    try {
      const latestVersion = await this.getLatestNpmVersion(source.name);
      if (installedVersion === latestVersion) {
        console.log(chalk.green(`${source.name} is already at latest version ${latestVersion}`));
        return;
      }
      console.log(chalk.cyan(`Updating ${source.name} from ${installedVersion} to ${latestVersion}`));
    } catch (err) {
      // Cannot check latest, proceed with reinstall anyway
      console.log(chalk.yellow(`Could not check latest version for ${source.name}, attempting reinstall...`));
    }

    // Reinstall
    if (scope === "user") {
      await this.runNpmCommand(["install", "-g", source.name, "--no-audit", "--no-fund"]);
    } else {
      const root = this.getProjectNpmRoot();
      await this.runNpmCommand(["install", source.name, "--prefix", root, "--no-audit", "--no-fund"]);
    }
  }

  private async updateGit(source: { type: "git"; host: string; path: string; ref?: string }, scope: "user" | "project"): Promise<void> {
    const targetDir = this.getGitInstallPath(source, scope);
    if (!existsSync(targetDir)) {
      console.log(chalk.yellow(`Skipping ${source.host}/${source.path}: not installed`));
      return;
    }

    // Fetch latest from remote
    console.log(chalk.cyan(`Updating git ${source.host}/${source.path}`));
    await this.runCommand("git", ["pull", "--rebase"], { cwd: targetDir }).catch(async (err: any) => {
      // If pull fails, try fetch + reset
      await this.runCommand("git", ["fetch", "origin"], { cwd: targetDir }).catch(() => {});
      const remoteRef = source.ref || "origin/HEAD";
      await this.runCommand("git", ["reset", "--hard", remoteRef], { cwd: targetDir }).catch(() => {});
    });

    // Run npm install if package.json exists
    const packageJsonPath = join(targetDir, "package.json");
    if (existsSync(packageJsonPath)) {
      await this.runNpmCommand(["install", "--prefix", targetDir]);
    }
  }

  private getInstalledNpmVersion(installedPath: string): string | undefined {
    const packageJsonPath = join(installedPath, "package.json");
    if (!existsSync(packageJsonPath)) return undefined;
    try {
      const content = readFileSync(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content) as { version?: string };
      return pkg.version;
    } catch {
      return undefined;
    }
  }

  private async getLatestNpmVersion(packageName: string): Promise<string> {
    const stdout = await this.runCommandCapture("npm", ["view", packageName, "version", "--json"]);
    const raw = stdout.trim();
    if (!raw) throw new Error("Empty response from npm view");
    return JSON.parse(raw);
  }

  private runCommandCapture(command: string, args: string[], options?: { cwd?: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options?.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
      let stdout = "";
      child.stdout.on("data", (data) => (stdout += data));
      child.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`${command} exited with code ${code}`));
      });
      child.on("error", reject);
    });
  }

  // ============================================================================
  // Private Implementation
  // ============================================================================

  private parseSource(source: string): ParsedSource {
    if (source.startsWith("npm:")) {
      const spec = source.slice(4);
      const match = spec.match(/^(@?[^@]+(?:\/[^@]+)?)(?:@(.+))?$/);
      const name = match ? match[1] : spec;
      return { type: "npm", name, pinned: !!match?.[2] };
    }
    if (source.startsWith("git:")) {
      const rest = source.slice(4);
      let host: string;
      let path: string;
      let ref: string | undefined;

      // git:github.com/user/repo
      // git:git@github.com:user/repo
      // git:https://github.com/user/repo
      if (rest.startsWith("git@")) {
        const atIdx = rest.indexOf("@");
        const colonIdx = rest.indexOf(":", atIdx);
        if (colonIdx !== -1) {
          host = rest.slice(atIdx + 1, colonIdx);
          path = rest.slice(colonIdx + 1);
        } else {
          host = "";
          path = rest;
        }
      } else if (rest.startsWith("https://")) {
        try {
          const url = new URL(rest);
          host = url.hostname;
          path = url.pathname.replace(/^\//, "");
          if (url.hash) {
            ref = url.hash.slice(1);
          }
        } catch {
          host = "";
          path = rest;
        }
      } else {
        // github.com/user/repo
        const slashIdx = rest.indexOf("/");
        if (slashIdx !== -1) {
          host = rest.slice(0, slashIdx);
          path = rest.slice(slashIdx + 1);
        } else {
          host = "";
          path = rest;
        }
      }

      return { type: "git", host, path, ref };
    }
    return { type: "local", path: source };
  }

  private validateParsed(parsed: ParsedSource): void {
    if (parsed.type === "npm") {
      if (!parsed.name || parsed.name.trim() === "") {
        throw new Error("Invalid npm source: missing package name");
      }
    } else if (parsed.type === "git") {
      if (!parsed.host || !parsed.path) {
        throw new Error("Invalid git source: missing host or path");
      }
      if (!parsed.path.includes("/")) {
        throw new Error("Invalid git source: path must be in the form host/path (e.g., github.com/user/repo)");
      }
    }
  }

  private getNpmInstallPath(source: { type: "npm"; name: string; pinned: boolean }, scope: "user" | "project"): string {
    if (scope === "project") {
      return join(this.cwd, ".piclaw", "npm", "node_modules", source.name);
    }
    const root = this.getGlobalNpmRoot();
    return join(root, source.name);
  }

  private getGitInstallRoot(scope: "user" | "project"): string {
    if (scope === "project") {
      return join(this.cwd, ".piclaw", "git");
    }
    return join(this.agentDir, "git");
  }

  private getGitInstallPath(source: { type: "git"; host: string; path: string; ref?: string }, scope: "user" | "project"): string {
    const root = this.getGitInstallRoot(scope);
    return join(root, source.host, source.path);
  }

  private async installGit(source: { type: "git"; host: string; path: string; ref?: string }, scope: "user" | "project"): Promise<void> {
    const targetDir = this.getGitInstallPath(source, scope);
    if (existsSync(targetDir)) return;
    const gitRoot = this.getGitInstallRoot(scope);
    if (!existsSync(gitRoot)) mkdirSync(gitRoot, { recursive: true });
    mkdirSync(dirname(targetDir), { recursive: true });

    const repo = `https://${source.host}/${source.path}.git`;
    await this.runCommand("git", ["clone", repo, targetDir]);
    if (source.ref) {
      await this.runCommand("git", ["checkout", source.ref], { cwd: targetDir });
    }
    // Install dependencies if package.json exists
    const packageJsonPath = join(targetDir, "package.json");
    if (existsSync(packageJsonPath)) {
      await this.runNpmCommand(["install", "--prefix", targetDir]);
    }
  }

  private async uninstallGit(source: { type: "git"; host: string; path: string }, scope: "user" | "project"): Promise<void> {
    const targetDir = this.getGitInstallPath(source, scope);
    if (!existsSync(targetDir)) return;
    rmSync(targetDir, { recursive: true, force: true });
    this.pruneEmptyParents(dirname(targetDir), this.getGitInstallRoot(scope));
  }

  private pruneEmptyParents(dir: string, root?: string): void {
    if (!root) return;
    const resolvedRoot = resolve(root);
    let current = dir;
    while (current.startsWith(resolvedRoot) && current !== resolvedRoot) {
      if (!existsSync(current)) {
        current = dirname(current);
        continue;
      }
      const entries = readdirSync(current);
      if (entries.length > 0) break;
      try {
        rmSync(current, { recursive: true, force: true });
      } catch { break; }
      current = dirname(current);
    }
  }

  private async installNpm(source: { type: "npm"; name: string; pinned: boolean }, scope: "user" | "project"): Promise<void> {
    const spec = source.name + (source.pinned ? `@${source.pinned}` : "");
    if (scope === "user") {
      await this.runNpmCommand(["install", "-g", spec]);
    } else {
      const root = this.getProjectNpmRoot();
      this.ensureNpmProject(root);
      await this.runNpmCommand(["install", spec, "--prefix", root, "--no-audit", "--no-fund"]);
    }
  }

  private async uninstallNpm(source: { type: "npm"; name: string; pinned: boolean }, scope: "user" | "project"): Promise<void> {
    if (scope === "user") {
      await this.runNpmCommand(["uninstall", "-g", source.name]);
    } else {
      const root = this.getProjectNpmRoot();
      await this.runNpmCommand(["uninstall", source.name, "--prefix", root]);
    }
  }

  private getProjectNpmRoot(): string {
    return join(this.cwd, ".piclaw", "npm");
  }

  private getGlobalNpmRoot(): string {
    try {
      const result = spawnSync("npm", ["root", "-g"], { encoding: "utf-8" });
      if (result.status === 0) return result.stdout.trim();
    } catch {}
    return join(getHomeDir(), ".npm", "global", "node_modules");
  }

  private ensureNpmProject(root: string): void {
    if (!existsSync(root)) mkdirSync(root, { recursive: true });
    const packageJsonPath = join(root, "package.json");
    if (!existsSync(packageJsonPath)) {
      writeFileSync(packageJsonPath, JSON.stringify({ name: "piclaw-extensions", private: true }, null, 2), "utf-8");
    }
  }

  private runNpmCommand(args: string[], cwd?: string): Promise<void> {
    return this.runCommand("npm", args, { cwd });
  }

  private async runCommand(command: string, args: string[], options?: { cwd?: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options?.cwd,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}`));
      });
      child.on("error", reject);
    });
  }

  // ============================================================================
  // Resource Collection
  // ============================================================================

  private collectPackageResources(
    packageRoot: string,
    accumulator: ResourceAccumulator,
    filter?: PackageFilter,
    metadata: PathMetadata,
  ): void {
    const collectFiles = (dir: string, pattern: RegExp): string[] => {
      const files: string[] = [];
      if (!existsSync(dir)) return files;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          const fullPath = join(dir, entry.name);
          const stats = entry.isSymbolicLink() ? statSync(fullPath) : entry;
          if (stats.isDirectory()) {
            files.push(...collectFiles(fullPath, pattern));
          } else if (stats.isFile() && pattern.test(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch {}
      return files;
    };

    const collectSkillFiles = (dir: string): string[] => {
      const files: string[] = [];
      if (!existsSync(dir)) return files;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          const fullPath = join(dir, entry.name);
          const stats = entry.isSymbolicLink() ? statSync(fullPath) : entry;
          if (stats.isDirectory()) {
            const skillMd = join(fullPath, "SKILL.md");
            if (existsSync(skillMd)) {
              files.push(skillMd);
            } else {
              files.push(...collectSkillFiles(fullPath));
            }
          } else if (stats.isFile() && entry.name.endsWith(".md")) {
            files.push(fullPath);
          }
        }
      } catch {}
      return files;
    };

    const addResource = (
      map: Map<string, { path: string; metadata: PathMetadata; enabled: boolean }>,
      filePath: string,
      enabled: boolean,
    ) => {
      const key = toPosixPath(filePath);
      if (!map.has(key)) {
        map.set(key, { path: filePath, metadata, enabled });
      }
    };

    // Extensions
    const extFiles = collectFiles(packageRoot, /\.(ts|js)$/);
    for (const f of extFiles) {
      addResource(accumulator.extensions, f, true);
    }

    // Skills
    const skillFiles = collectSkillFiles(packageRoot);
    for (const f of skillFiles) {
      addResource(accumulator.skills, f, true);
    }

    // Prompts
    const promptFiles = collectFiles(packageRoot, /\.md$/).filter((p) => !p.endsWith("SKILL.md"));
    for (const f of promptFiles) {
      addResource(accumulator.prompts, f, true);
    }

    // Themes
    const themeFiles = collectFiles(packageRoot, /\.json$/);
    for (const f of themeFiles) {
      addResource(accumulator.themes, f, true);
    }

    // Apply filter if provided
    if (filter) {
      const applyFilter = (map: Map<string, { path: string; metadata: PathMetadata; enabled: boolean }>, type: keyof PackageFilter) => {
        const patterns = filter[type];
        if (patterns === undefined) return; // no filter for this type
        for (const [key, entry] of map.entries()) {
          const relPath = toPosixPath(relative(packageRoot, entry.path));
          if (!matchesAnyPattern(relPath, patterns)) {
            map.delete(key);
          }
        }
      };
      applyFilter(accumulator.extensions, "extensions");
      applyFilter(accumulator.skills, "skills");
      applyFilter(accumulator.prompts, "prompts");
      applyFilter(accumulator.themes, "themes");
    }
  }
}
