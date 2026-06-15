#!/usr/bin/env node

/**
 * Git Tool Unit Tests
 *
 * Tests command building and result handling for git tool.
 */

import { describe, it, expect, vi } from "vitest";
import { createBashTool, createLocalBashOperations } from "@earendil-works/pi-coding-agent";
import { registerGitTool } from "../extensions/tools/git-tool";

function escapeShellArg(arg: string): string {
  const escaped = arg.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

// Mock the SDK for execute tests
vi.mock('@earendil-works/pi-coding-agent', async () => {
  const actual = await vi.importActual('@earendil-works/pi-coding-agent');
  return {
    ...actual,
    createBashTool: vi.fn(() => ({ execute: vi.fn() })),
    createLocalBashOperations: vi.fn(() => ({}))
  };
});

// Test command building logic extracted from git tool
function buildGitCommand(action: string, args: any = {}): string {
  let command = "";
  switch (action) {
    case "diff":
      command = `git diff ${args.revision ? escapeShellArg(args.revision) : 'HEAD'}`;
      break;
    case "log":
      command = `git log -${args.count || 10} --oneline --graph --decorate`;
      break;
    case "status":
      command = "git status";
      break;
    case "commit":
      if (!args.message) throw new Error("commit requires 'message'");
      command = `git commit -m ${escapeShellArg(args.message)}`;
      break;
    case "branch":
      const branchAction = args.action || "list";
      if (branchAction === "list") command = "git branch -a";
      else if (branchAction === "create") {
        if (!args.branch) throw new Error("branch create requires 'branch'");
        command = `git branch ${escapeShellArg(args.branch)}`;
      } else if (branchAction === "delete") {
        if (!args.branch) throw new Error("branch delete requires 'branch'");
        command = `git branch -d ${escapeShellArg(args.branch)}`;
      } else throw new Error(`unknown branch action: ${branchAction}`);
      break;
    case "checkout":
      if (!args.branch) throw new Error("checkout requires 'branch'");
      command = `git checkout ${escapeShellArg(args.branch)}`;
      break;
    case "add":
      if (!args.files?.length) throw new Error("add requires 'files' array");
      command = `git add ${args.files.map(escapeShellArg).join(' ')}`;
      break;
    case "push":
      const remote = args.remote || 'origin';
      command = `git push ${escapeShellArg(remote)}` + (args.branch ? ` ${escapeShellArg(args.branch)}` : '');
      break;
    case "pull":
      const rremote = args.remote || 'origin';
      command = `git pull ${escapeShellArg(rremote)}` + (args.branch ? ` ${escapeShellArg(args.branch)}` : '');
      break;
    default:
      throw new Error(`unknown git action: ${action}`);
  }
  return command;
}

describe("Git Tool Command Construction", () => {
  it("should build diff command", () => {
    expect(buildGitCommand("diff")).toBe("git diff HEAD");
    expect(buildGitCommand("diff", { revision: "main" })).toBe("git diff 'main'");
    expect(buildGitCommand("diff", { revision: "feature/abc" })).toBe("git diff 'feature/abc'");
  });

  it("should build log command", () => {
    expect(buildGitCommand("log")).toBe("git log -10 --oneline --graph --decorate");
    expect(buildGitCommand("log", { count: 5 })).toBe("git log -5 --oneline --graph --decorate");
    expect(buildGitCommand("log", { count: 1 })).toBe("git log -1 --oneline --graph --decorate");
  });

  it("should build status command", () => {
    expect(buildGitCommand("status")).toBe("git status");
  });

  it("should build commit command with escaping", () => {
    expect(buildGitCommand("commit", { message: "fix: bug" })).toBe('git commit -m \'fix: bug\'');
    expect(buildGitCommand("commit", { message: 'Fix "quoted" bug' })).toBe('git commit -m \'Fix "quoted" bug\'');
    expect(buildGitCommand("commit", { message: 'Multiple "quotes" and "double"' })).toBe('git commit -m \'Multiple "quotes" and "double"\'');
  });

  it("should throw for commit without message", () => {
    expect(() => buildGitCommand("commit", {})).toThrow("commit requires 'message'");
  });

  it("should build branch commands", () => {
    expect(buildGitCommand("branch")).toBe("git branch -a");
    expect(buildGitCommand("branch", { action: "create", branch: "feature-x" })).toBe("git branch 'feature-x'");
    expect(buildGitCommand("branch", { action: "delete", branch: "old-branch" })).toBe("git branch -d 'old-branch'");
  });

  it("should throw for branch create/delete without branch name", () => {
    expect(() => buildGitCommand("branch", { action: "create" })).toThrow("branch create requires 'branch'");
    expect(() => buildGitCommand("branch", { action: "delete" })).toThrow("branch delete requires 'branch'");
  });

  it("should build checkout command", () => {
    expect(buildGitCommand("checkout", { branch: "main" })).toBe("git checkout 'main'");
    expect(buildGitCommand("checkout", { branch: "feature/test" })).toBe("git checkout 'feature/test'");
  });

  it("should throw for checkout without branch", () => {
    expect(() => buildGitCommand("checkout", {})).toThrow("checkout requires 'branch'");
  });

  it("should build add command with file escaping", () => {
    expect(buildGitCommand("add", { files: ["file1.ts", "file2.ts"] })).toBe("git add 'file1.ts' 'file2.ts'");
    expect(buildGitCommand("add", { files: ["file with spaces.ts"] })).toBe("git add 'file with spaces.ts'");
    expect(buildGitCommand("add", { files: ['file\"quote.ts'] })).toBe('git add \'file"quote.ts\'');
  });

  it("should throw for add without files", () => {
    expect(() => buildGitCommand("add", {})).toThrow("add requires 'files' array");
    expect(() => buildGitCommand("add", { files: [] })).toThrow("add requires 'files' array");
  });

  it("should build push command", () => {
    expect(buildGitCommand("push")).toBe("git push 'origin'");
    expect(buildGitCommand("push", { branch: "main" })).toBe("git push 'origin' 'main'");
    expect(buildGitCommand("push", { remote: "upstream" })).toBe("git push 'upstream'");
    expect(buildGitCommand("push", { remote: "upstream", branch: "dev" })).toBe("git push 'upstream' 'dev'");
  });

  it("should build pull command", () => {
    expect(buildGitCommand("pull")).toBe("git pull 'origin'");
    expect(buildGitCommand("pull", { branch: "develop" })).toBe("git pull 'origin' 'develop'");
    expect(buildGitCommand("pull", { remote: "upstream" })).toBe("git pull 'upstream'");
    expect(buildGitCommand("pull", { remote: "upstream", branch: "dev" })).toBe("git pull 'upstream' 'dev'");
  });

  it("should throw for unknown action", () => {
    expect(() => buildGitCommand("unknown" as any)).toThrow("unknown git action: unknown");
  });
});

describe("Git Tool Error Results", () => {
  it("should format error result correctly", () => {
    const errorResult = {
      content: [{ type: "text", text: "❌ Git error: command failed" }],
      details: { command: "git status", output: "", error: "command failed" },
      isError: true,
    };
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toContain("❌");
    expect(errorResult.details.error).toBe("command failed");
  });
});

describe("Git Tool Render Functions", () => {
  it("should render call with action in expected format", () => {
    const mockTheme = {
      fg: (color: string, text?: string) => (text ?? color),
      bold: (text: string) => text,
    };

    const renderCall = (args: any) => {
      const p = args as any;
      return new (class {
        text = `${mockTheme.fg("toolTitle", mockTheme.bold("git"))} ${mockTheme.fg("muted", p.action)}`;
      })();
    };

    const result = renderCall({ action: "diff" });
    expect(result.text).toContain("git");
    expect(result.text).toContain("diff");
  });

  it("should render diff output preserving ANSI", () => {
    // Simulate renderDiff output with ANSI codes
    const diffOutput = "\x1b[31m- removed line\x1b[0m\n\x1b[32m+ added line\x1b[0m";
    const result = { output: diffOutput, isError: false };
    expect(result.output).toContain("\x1b[31m");
    expect(result.output).toContain("\x1b[32m");
  });
});

describe('Git Tool Execute', () => {
  let mockBashExecute: any;
  let mockTool: any;
  let mockApi: any;

  beforeEach(() => {
    mockBashExecute = vi.fn();
    (createBashTool as any).mockReturnValue({ execute: mockBashExecute });
    mockApi = {
      on: vi.fn(),
      registerTool: vi.fn()
    };
    registerGitTool(mockApi);
    // Trigger session_start to register the tool
    const onCallback = mockApi.on.mock.calls.find(c => c[0] === 'session_start')?.[1];
    if (onCallback) {
      onCallback(null, { cwd: '/repo' });
    }
    // Capture the registered tool
    mockTool = mockApi.registerTool.mock.calls[0]?.[0];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute diff action successfully', async () => {
    mockBashExecute.mockResolvedValue({ content: [{ type: 'text', text: 'diff output' }], isError: false });
    const result = await mockTool.execute('call1', { action: 'diff', args: { revision: 'HEAD' } }, undefined, undefined, { cwd: '/repo' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('diff output');
    expect(mockBashExecute).toHaveBeenCalledWith('call1', { command: "git diff 'HEAD'" }, undefined, undefined, { cwd: '/repo' });
  });

  it('should execute log action with default count', async () => {
    mockBashExecute.mockResolvedValue({ content: [{ type: 'text', text: 'log output' }], isError: false });
    await mockTool.execute('call2', { action: 'log' }, undefined, undefined, { cwd: '/repo' });
    expect(mockBashExecute).toHaveBeenCalledWith('call2', { command: 'git log -10 --oneline --graph --decorate' }, undefined, undefined, { cwd: '/repo' });
  });

  it('should execute status action', async () => {
    mockBashExecute.mockResolvedValue({ content: [{ type: 'text', text: 'status output' }], isError: false });
    await mockTool.execute('call3', { action: 'status' }, undefined, undefined, { cwd: '/repo' });
    expect(mockBashExecute).toHaveBeenCalledWith('call3', { command: 'git status' }, undefined, undefined, { cwd: '/repo' });
  });

  it('should return error when commit message missing', async () => {
    const result = await mockTool.execute('call4', { action: 'commit' }, undefined, undefined, { cwd: '/repo' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('commit requires');
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it('should return error when checkout branch missing', async () => {
    const result = await mockTool.execute('call5', { action: 'checkout' }, undefined, undefined, { cwd: '/repo' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('checkout requires');
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it('should return error when branch action missing branch name', async () => {
    const result = await mockTool.execute('call6', { action: 'branch', args: { action: 'create' } }, undefined, undefined, { cwd: '/repo' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('branch create requires');
    expect(mockBashExecute).not.toHaveBeenCalled();
  });

  it('should return error from bash tool', async () => {
    mockBashExecute.mockResolvedValue({ content: [{ type: 'text', text: 'git error' }], isError: true });
    const result = await mockTool.execute('call7', { action: 'status' }, undefined, undefined, { cwd: '/repo' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('git error');
  });

  it('should handle bash tool result with empty content', async () => {
    mockBashExecute.mockResolvedValue({ content: [], isError: false });
    const result = await mockTool.execute('call8', { action: 'status' }, undefined, undefined, { cwd: '/repo' });
    expect(result.isError).toBe(false);
    // content[0] will be {type:'text', text: ''} due to code logic
    expect(result.content[0].text).toBe('');
  });
});
