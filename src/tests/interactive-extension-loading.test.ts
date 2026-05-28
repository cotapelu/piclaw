import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { bootPiclaw } from "../piclaw-core.js";

describe("Interactive Extension Loading from .piclaw/npm", () => {
  let originalHome: string;
  let tempHome: string;
  let cwd: string;
  let agentDir: string;

  beforeEach(() => {
    originalHome = homedir();
    tempHome = join(originalHome, ".piclaw-test-interactive");
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    mkdirSync(tempHome, { recursive: true });
    vi.stubEnv('HOME', tempHome);

    cwd = join(tempHome, "test-project");
    mkdirSync(cwd, { recursive: true });
    agentDir = join(homedir(), ".piclaw", "agent");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it("should load extensions from .piclaw/npm packages", async () => {
    // Simulate installed npm package with extension
    const pkgRoot = join(cwd, ".piclaw", "npm", "node_modules", "test-ext-pkg");
    mkdirSync(join(pkgRoot, "extensions"), { recursive: true });
    writeFileSync(join(pkgRoot, "extensions", "my-extension.ts"), `
      export class MyExtension {
        execute() { return "Hello from MyExtension"; }
      }
    `);

    // Boot runtime
    const runtime = await bootPiclaw({ cwd, agentDir });

    // Check that extension is available in the model registry or extension runner
    // Since extensions are loaded via resource loader, they should be registered
    const extensionRunner = (runtime.session.extensionRunner as any);
    expect(extensionRunner).toBeDefined();

    // Extensions are usually loaded and available as tools
    // We can check that the extension's tool is registered
    if (runtime.session?.agent?.toolRegistry) {
      const tools = runtime.session.agent.toolRegistry.listTools();
      // Verify our test extension's tool is available
      const myExtTool = tools.find((t: any) => t.name === "my-extension");
      expect(myExtTool).toBeDefined();
    } else if (extensionRunner.loadedExtensions) {
      const loaded = extensionRunner.loadedExtensions as Array<{ name: string }>;
      expect(loaded.some((ext: any) => ext.name === "my-extension")).toBe(true);
    }
  }, 10000);
});
