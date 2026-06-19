import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PiclawPackageManager } from "../piclaw-package-manager.js";
import type { ExtensionLogger } from "../extensions/utils/logger.js";

function createMockLogger(): { log: any; warn: any; error: any } {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("PiclawPackageManager.update", () => {
  let pm: PiclawPackageManager;
  let getEntriesSpy: any;
  let updateNpmSpy: any;
  let updateGitSpy: any;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    pm = new PiclawPackageManager({ cwd: "/tmp/cwd", agentDir: "/tmp/agent" }, mockLogger as any);
    getEntriesSpy = vi.spyOn(pm, 'getConfiguredEntries');
    updateNpmSpy = vi.spyOn(pm, 'updateNpm').mockResolvedValue(undefined);
    updateGitSpy = vi.spyOn(pm, 'updateGit').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log 'No packages to update.' when no configured packages", async () => {
    getEntriesSpy.mockReturnValue([]);
    await pm.update();
    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining("No packages to update."));
  });

  it("should perform dry-run without calling updateNpm/updateGit", async () => {
    getEntriesSpy.mockReturnValue([{ source: "npm:dummy", scope: "user" }]);

    await pm.update(undefined, { dryRun: true });

    expect(updateNpmSpy).not.toHaveBeenCalled();
    expect(updateGitSpy).not.toHaveBeenCalled();
    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining("[DRY-RUN]"));
  });

  it("should call updateNpm for npm package", async () => {
    getEntriesSpy.mockReturnValue([{ source: "npm:test", scope: "user" }]);
    await pm.update();
    expect(updateNpmSpy).toHaveBeenCalledTimes(1);
    const [source, scope] = updateNpmSpy.mock.calls[0] as [any, string];
    expect(source.type).toBe("npm");
    expect(source.name).toBe("test");
    expect(source.pinned).toBe(false);
    expect(scope).toBe("user");
  });

  it("should call updateGit for git package", async () => {
    getEntriesSpy.mockReturnValue([{ source: "git:github.com/user/repo", scope: "user" }]);
    await pm.update();
    expect(updateGitSpy).toHaveBeenCalledTimes(1);
    const [source, scope] = updateGitSpy.mock.calls[0] as [any, string];
    expect(source.type).toBe("git");
    expect(source.host).toBe("github.com");
    expect(source.path).toBe("user/repo");
    expect(scope).toBe("user");
  });

  it("should skip unsupported source types", async () => {
    getEntriesSpy.mockReturnValue([
      { source: "/local/path", scope: "user" },
      { source: "npm:valid", scope: "user" }
    ]);

    await pm.update();

    expect(updateNpmSpy).toHaveBeenCalledTimes(1);
    const [source] = updateNpmSpy.mock.calls[0] as [any];
    expect(source.name).toBe("valid");
    const warningMsgs = mockLogger.log.mock.calls
      .map(args => args[0] as string)
      .filter(msg => msg.includes('Skipping'));
    expect(warningMsgs.length).toBeGreaterThan(0);
  });

  it("should filter by source when provided", async () => {
    getEntriesSpy.mockReturnValue([
      { source: "npm:pkg1", scope: "user" },
      { source: "npm:pkg2", scope: "user" }
    ]);
    await pm.update("npm:pkg1");
    expect(updateNpmSpy).toHaveBeenCalledTimes(1);
    const [source] = updateNpmSpy.mock.calls[0] as [any];
    expect(source.name).toBe("pkg1");
  });

  it("should respect local: false as user scope", async () => {
    getEntriesSpy.mockReturnValue([{ source: "npm:global-pkg", scope: "user" }]);
    await pm.update(undefined, { local: false });
    expect(updateNpmSpy).toHaveBeenCalledWith(expect.objectContaining({ name: "global-pkg" }), "user");
  });

  it("should respect local: true as project scope", async () => {
    getEntriesSpy.mockReturnValue([{ source: "npm:project-pkg", scope: "project" }]);
    await pm.update(undefined, { local: true });
    expect(updateNpmSpy).toHaveBeenCalledWith(expect.objectContaining({ name: "project-pkg" }), "project");
  });
});
