#!/usr/bin/env node

/**
 * Secret Scanner Tool
 *
 * Scans files for potential leaked secrets (API keys, tokens, private keys).
 * Registers both a tool (for agent) and a slash command `/scan-secrets`.
 */

import { join, relative } from "node:path";
import { readdir, stat, readFile } from "node:fs/promises";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("SecretScanner");

// Patterns
const PATTERNS: { type: string; regex: RegExp }[] = [
  { type: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { type: "GitHub Token", regex: /ghp_[0-9a-zA-Z]{36}/ },
  { type: "GitHub Token", regex: /github_pat_[0-9a-zA-Z]{22}_[0-9a-zA-Z]{59}/ },
  { type: "Google API Key", regex: /AIza[0-9A-Za-z\-_]{35}/ },
  { type: "Slack Token", regex: /xox[baprs]-[0-9a-zA-Z-]{10,}/ },
  { type: "JWT", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { type: "Private Key", regex: /-----BEGIN (RSA )?PRIVATE KEY-----/ },
  { type: "Stripe Secret", regex: /sk_live_[0-9a-zA-Z]{24}/ },
  { type: "SendGrid API Key", regex: /SG\.[0-9A-Za-z_-]{43}\.[0-9A-Za-z_-]{10}/ },

  // Additional patterns (expanded 2026-06-15)
  { type: "Azure Storage Key", regex: /[a-f0-9]{64}/ },
  { type: "Heroku API Key", regex: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/ },
  { type: "DigitalOcean Token", regex: /do[0-9a-f]{64}/ },
  { type: "Cloudflare API Token", regex: /[0-9a-f]{40}/ },
  { type: "Datadog API Key", regex: /[a-z0-9]{32}/ },
  { type: "New Relic Key", regex: /NRAK-[A-Z0-9]{27}/ },
  { type: "Twilio", regex: /SK[0-9a-fA-F]{32}/ },
  // New patterns (2026-06-15)
  { type: "OpenAI API Key", regex: /sk-[A-Za-z0-9]{48}/ },
  { type: "Anthropic API Key", regex: /sk-ant-[A-Za-z0-9]{32,}/ },
  { type: "Replicate API Token", regex: /r8_[0-9a-zA-Z]{40}/ },
  { type: "Hugging Face Token", regex: /hf_[0-9a-zA-Z]{34,}/ },
];

const DEFAULT_EXTENSIONS = [".js",".ts",".json",".env",".yml",".yaml",".md",".txt",".sh",".py",".rb",".php",".java",".c",".cpp",".h",".hpp",".rs",".go",".env.local",".config"];
const DEFAULT_EXCLUDE = ["node_modules",".git","dist","build","coverage",".next",".nuxt","vendor"];
const DEFAULT_MAX_SIZE = 1024 * 1024; // 1MB

async function shouldScanFile(filePath: string, extensions: string[], exclude: string[], maxSize: number): Promise<boolean> {
  const ext = "." + (filePath.split(".").pop() || "");
  if (!extensions.includes(ext)) return false;
  if (exclude.some(dir => filePath.includes(dir))) return false;
  try {
    const stats = await stat(filePath);
    if (stats.size > maxSize) return false;
  } catch {
    return false;
  }
  return true;
}

async function scanFile(filePath: string): Promise<{ file: string; line: number; match: string; type: string }[]> {
  const results: { file: string; line: number; match: string; type: string }[] = [];
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      PATTERNS.forEach(({ type, regex }) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
          results.push({ file: filePath, line: idx + 1, match: match[0], type });
          if (regex.lastIndex === match.index) regex.lastIndex++;
        }
      });
    });
  } catch {}
  return results;
}

async function scanDirectory(root: string, options: { path: string; extensions: string[]; exclude: string[]; maxSize: number }): Promise<any[]> {
  const results: any[] = [];
  const visited = new Set<string>();

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (visited.has(fullPath)) continue;
      visited.add(fullPath);

      if (entry.isDirectory()) {
        if (!options.exclude.includes(entry.name)) await walk(fullPath);
      } else if (entry.isFile()) {
        if (await shouldScanFile(fullPath, options.extensions, options.exclude, options.maxSize)) {
          const fileResults = await scanFile(fullPath);
          if (fileResults.length) results.push(...fileResults);
        }
      }
    }
  }

  await walk(root);
  return results;
}

// Shared scan runner
async function runScan(args: {
  path?: string;
  extensions?: string;
  exclude?: string;
  max_size_kb?: number;
} = {}): Promise<{
  status: "clean" | "found";
  message?: string;
  count?: number;
  files?: string[];
  output?: string;
}> {
  const cwd = process.cwd();
  const scanPath = args.path || cwd;
  const extensions = args.extensions ? args.extensions.split(",") : DEFAULT_EXTENSIONS;
  const exclude = args.exclude ? args.exclude.split(",") : DEFAULT_EXCLUDE;
  const maxSize = (args.max_size_kb || DEFAULT_MAX_SIZE / 1024) * 1024;

  const results = await scanDirectory(scanPath, { path: scanPath, extensions, exclude, maxSize });

  const unique = Array.from(new Map(results.map(r => [`${r.file}:${r.line}:${r.type}`, r])).values());

  if (unique.length === 0) {
    return { status: "clean", message: "No potential secrets found." };
  }

  const byFile: Record<string, typeof results> = {};
  unique.forEach(r => {
    if (!byFile[r.file]) byFile[r.file] = [];
    byFile[r.file].push(r);
  });

  const summary = Object.entries(byFile).map(([file, finds]) => {
    const lines = finds.map(f => `  L${f.line}: ${f.type} - ${f.match}`).join("\n");
    return `${file}:\n${lines}`;
  }).join("\n");

  const output = `Found ${unique.length} potential secret(s) in ${Object.keys(byFile).length} file(s):\n\n${summary}\n\nReview and rotate these secrets immediately.`;

  return {
    status: "found",
    count: unique.length,
    files: Object.keys(byFile),
    output,
  };
}

export function registerSecretScannerTool(api: any) {
  const tool = {
    name: "secret_scanner",
    label: "Secret Scanner",
    description: "Scans files for potential leaked secrets (API keys, tokens, private keys).",
    promptSnippet: "secret_scanner()",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory to scan (default: current working directory)" },
        extensions: { type: "string", description: "Comma-separated file extensions to scan (e.g., .js,.ts,.json,.env)" },
        exclude: { type: "string", description: "Comma-separated directories to exclude (default: node_modules,.git,dist,build)" },
        max_size_kb: { type: "number", description: "Maximum file size in KB (default: 1024)" },
      },
    },
    async execute(
      _toolCallId: string,
      args: any,
      _signal: AbortSignal | undefined,
      _onUpdate: any,
      _ctx: any
    ): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
      const result = await runScan(args);
      const text = result.output || result.message || "";
      return {
        content: [{ type: "text", text }],
        isError: false,
      };
    },
  };

  api.registerTool(tool);

  api.registerCommand("scan-secrets", {
    description: "Scan the workspace for leaked secrets",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const result = await runScan({});
      if (result.status === "clean") {
        ctx.ui.notify(result.message!, "info");
      } else {
        ctx.ui.notify(`Found ${result.count} potential secret(s) in ${result.files!.length} file(s). Check console for details.`, "warning");
        logger.info(result.output);
      }
    },
  });
}

export default registerSecretScannerTool;
