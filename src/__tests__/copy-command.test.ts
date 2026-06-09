import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the external module before imports
vi.mock("@earendil-works/pi-coding-agent", async () => {
  const originalModule = await vi.importActual("@earendil-works/pi-coding-agent");
  return {
    ...originalModule,
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
  };
});

import { registerCopyCommand } from "../extensions/commands/copy-command.js";

const mockNotify = vi.fn();

const mockSessionEntry = (role: string, text: string) => ({
  type: "message" as const,
  message: {
    role,
    content: [{ type: "text", text }],
  },
});

const createMockCtx = (tree: any[] = []) => ({
  sessionManager: {
    getTree: () => tree,
  },
  ui: {
    notify: mockNotify,
  },
});

const createMockApi = () => ({
  registerCommand: vi.fn(),
});

describe("Copy Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerCopyCommand", () => {
    it("should register command with correct name", () => {
      const api = createMockApi();
      registerCopyCommand(api);
      expect(api.registerCommand).toHaveBeenCalledWith("copy", expect.any(Object));
    });

    it("should handle missing session manager", async () => {
      const api = createMockApi();
      registerCopyCommand(api);

      const ctx = createMockCtx([]);
      ctx.sessionManager = null;

      // Get the handler
      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(mockNotify).toHaveBeenCalledWith("Session manager not available", "error");
    });

    it("should handle empty session history", async () => {
      const api = createMockApi();
      registerCopyCommand(api);

      const ctx = createMockCtx([]);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(mockNotify).toHaveBeenCalledWith("No session history", "error");
    });

    it("should handle no assistant messages", async () => {
      const api = createMockApi();
      registerCopyCommand(api);

      // Tree with only user messages
      const tree = [
        { entry: mockSessionEntry("user", "Hello") },
        { entry: mockSessionEntry("user", "How are you?") },
      ];
      const ctx = createMockCtx(tree);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(mockNotify).toHaveBeenCalledWith("No assistant response found", "error");
    });

    it("should copy last assistant response", async () => {
      const { copyToClipboard } = await import("@earendil-works/pi-coding-agent");

      const api = createMockApi();
      registerCopyCommand(api);

      const tree = [
        { entry: mockSessionEntry("user", "Hello") },
        { entry: mockSessionEntry("assistant", "Hi there!") },
        { entry: mockSessionEntry("user", "How are you?") },
        { entry: mockSessionEntry("assistant", "I'm good, thanks!") }, // last assistant
      ];
      const ctx = createMockCtx(tree);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(copyToClipboard).toHaveBeenCalledWith("I'm good, thanks!");
      expect(mockNotify).toHaveBeenCalledWith("Copied last assistant response to clipboard", "info");
    });

    it("should skip empty assistant responses", async () => {
      const { copyToClipboard } = await import("@earendil-works/pi-coding-agent");

      const api = createMockApi();
      registerCopyCommand(api);

      const tree = [
        { entry: mockSessionEntry("user", "Hello") },
        { entry: mockSessionEntry("assistant", "") }, // empty
        { entry: mockSessionEntry("assistant", "   ") }, // whitespace only
        { entry: mockSessionEntry("assistant", "Real response") },
      ];
      const ctx = createMockCtx(tree);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(copyToClipboard).toHaveBeenCalledWith("Real response");
    });

    it("should handle copy error", async () => {
      const { copyToClipboard } = await import("@earendil-works/pi-coding-agent");
      copyToClipboard.mockRejectedValue(new Error("Clipboard access denied"));

      const api = createMockApi();
      registerCopyCommand(api);

      const tree = [
        { entry: mockSessionEntry("assistant", "Test message") },
      ];
      const ctx = createMockCtx(tree);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(mockNotify).toHaveBeenCalledWith("Failed to copy: Clipboard access denied", "error");
    });
  });
});
