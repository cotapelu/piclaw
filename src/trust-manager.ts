#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createInterface } from "node:readline";
import { logger } from "./utils/logger.js";

const TRUST_STORE_FILENAME = "trust.json";

interface TrustRecord {
  trusted: boolean;
  timestamp: number;
}

type TrustStore = Record<string, TrustRecord>;

/**
 * TrustManager: Handles project trust decisions.
 *
 * - Checks if project has trust inputs (AGENTS.md, CLAUDE.md, .piclaw/)
 * - Persists trust decisions to ~/.piclaw/agent/trust.json
 * - Provides interactive prompt for user decision
 */
export class TrustManager {
  private store: TrustStore;
  private agentDir: string;

  constructor(agentDir: string) {
    this.agentDir = agentDir;
    this.store = this.load();
  }

  private getStorePath(): string {
    return join(this.agentDir, TRUST_STORE_FILENAME);
  }

  private load(): TrustStore {
    const path = this.getStorePath();
    if (existsSync(path)) {
      try {
        const data = readFileSync(path, "utf-8");
        return JSON.parse(data) as TrustStore;
      } catch (err: any) {
        logger.warn(`Failed to load trust store: ${err.message}`);
      }
    }
    return {};
  }

  private save(): void {
    const path = this.getStorePath();
    try {
      const dir = dirname(path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(path, JSON.stringify(this.store, null, 2), "utf-8");
    } catch (err: any) {
      logger.warn(`Failed to save trust store: ${err.message}`);
    }
  }

  /**
   * Check if a project directory has any trust inputs.
   * Trust inputs: AGENTS.md, CLAUDE.md, .piclaw/ directory
   */
  hasTrustInputs(cwd: string): boolean {
    const agentsPath = join(cwd, "AGENTS.md");
    const claudePath = join(cwd, "CLAUDE.md");
    const piclawDir = join(cwd, ".piclaw");

    return existsSync(agentsPath) || existsSync(claudePath) || existsSync(piclawDir);
  }

  /**
   * Get cached trust decision for a project, if any.
   * @returns true (trusted), false (not trusted), or null (no cached decision)
   */
  getCachedTrust(cwd: string): boolean | null {
    const record = this.store[cwd];
    if (!record) return null;
    return record.trusted;
  }

  /**
   * Record trust decision for a project.
   */
  setTrust(cwd: string, trusted: boolean): void {
    this.store[cwd] = {
      trusted,
      timestamp: Date.now(),
    };
    this.save();
    logger.debug(`Trust decision saved for ${cwd}: ${trusted ? "trusted" : "not trusted"}`);
  }

  /**
   * Resolve trust decision for a project.
   *
   * Priority:
   * 1. Force override (from CLI --project-trust-override)
   * 2. Cached decision (from trust store)
   * 3. Interactive prompt (if interactive mode)
   * 4. Default: false (if not interactive) or true (if no trust inputs)
   *
   * @param cwd - Project directory
   * @param interactive - Whether to prompt user in interactive mode
   * @param force - Force trust/untrust (from CLI)
   * @returns boolean - true if trusted, false otherwise
   */
  async resolve(
    cwd: string,
    options: {
      interactive: boolean;
      force?: boolean;
    }
  ): Promise<boolean> {
    // 1. Force override (from CLI flag)
    if (options.force !== undefined) {
      logger.debug(`Trust override (force=${options.force}) for ${cwd}`);
      return options.force;
    }

    // 2. Cached decision?
    const cached = this.getCachedTrust(cwd);
    if (cached !== null) {
      logger.debug(`Using cached trust for ${cwd}: ${cached}`);
      return cached;
    }

    // 3. No trust inputs → auto-trust
    if (!this.hasTrustInputs(cwd)) {
      logger.debug(`No trust inputs in ${cwd}, auto-trust`);
      return true;
    }

    // 4. Not interactive → default false (conservative)
    if (!options.interactive) {
      logger.debug(`Non-interactive mode, default not trust for ${cwd}`);
      return false;
    }

    // 5. Interactive prompt
    const trusted = await this.promptUser(cwd);
    if (trusted !== undefined) {
      this.setTrust(cwd, trusted);
      return trusted;
    }

    // User cancelled → false
    return false;
  }

  /**
   * Prompt user to trust/untrust a project (console-based).
   * Returns true (trust), false (do not trust), or undefined (cancel).
   */
  private async promptUser(cwd: string): Promise<boolean | undefined> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const message = `Trust project folder?\n${cwd}\n\nThis allows piclaw to read project instructions (AGENTS.md/CLAUDE.md), load .piclaw settings and resources, and execute project extensions.`;
      const options = [
        { label: "Trust", value: true },
        { label: "Do not trust", value: false },
        { label: "Cancel", value: undefined },
      ];

      console.log("");
      console.log(message);
      for (let i = 0; i < options.length; i++) {
        console.log(`  ${i + 1}. ${options[i].label}`);
      }

      rl.question("Select (1-3, default Cancel): ", (answer: string) => {
        rl.close();
        const idx = parseInt(answer.trim(), 10) - 1;
        if (idx >= 0 && idx < options.length) {
          resolve(options[idx].value);
        } else {
          resolve(undefined);
        }
      });
    });
  }
}

/**
 * Convenience function to create TrustManager using agent directory.
 */
export function createTrustManager(agentDir: string): TrustManager {
  return new TrustManager(agentDir);
}
