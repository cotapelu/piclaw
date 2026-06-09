import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerSessionTreeCommand } from "../extensions/commands/session-tree-command.js";

// Mock SDK and TUI
vi.mock("@earendil-works/pi-coding-agent", () => ({
  DynamicBorder: class DynamicBorder {},
  TreeSelectorComponent: class TreeSelectorComponent {
    getTreeList() { return { getSelectedNode: () => null }; }
    handleInput() {}
  },
}));

vi.mock("@earendil-works/pi-tui", () => ({
  Container: class Container {
    addChild() {}
    render() { return []; }
    invalidate() {}
  },
  Text: class Text { constructor(public content: string) {} },
  Spacer: class Spacer {},
}));

const mockNotify = vi.fn();
const mockCustom = vi.fn();

const createMockCtx = (overrides = {}) => ({
  sessionManager: {
    getTree: () => [{ id: "e1", type: "message", parentId: null, timestamp: Date.now() }],
    getLeafId: () => "e1",
  },
  mode: "tui",
  ui: {
    notify: mockNotify,
    custom: mockCustom,
  },
  ...overrides,
});

const createMockApi = () => ({ registerCommand: vi.fn() });

describe("Session Tree Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register command correctly", () => {
    const api = createMockApi();
    registerSessionTreeCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith("tree", expect.any(Object));
  });

  it("should require TUI mode", async () => {
    const api = createMockApi();
    registerSessionTreeCommand(api);
    const ctx = createMockCtx({ mode: "print" });
    const handler = api.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);
    expect(mockNotify).toHaveBeenCalledWith("/tree requires TUI mode", "error");
    expect(mockCustom).not.toHaveBeenCalled();
  });

  it("should require session manager", async () => {
    const api = createMockApi();
    registerSessionTreeCommand(api);
    const ctx = createMockCtx({ sessionManager: null });
    const handler = api.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);
    expect(mockNotify).toHaveBeenCalledWith("Session manager not available", "error");
    expect(mockCustom).not.toHaveBeenCalled();
  });

  it("should call custom UI in TUI mode", async () => {
    const api = createMockApi();
    registerSessionTreeCommand(api);
    const ctx = createMockCtx();
    const handler = api.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);
    expect(mockCustom).toHaveBeenCalled();
    // The argument to custom is a function (component factory)
    const componentFactory = mockCustom.mock.calls[0][0];
    expect(typeof componentFactory).toBe("function");
  });

  it("should notify when entry selected", async () => {
    const api = createMockApi();
    registerSessionTreeCommand(api);
    mockCustom.mockResolvedValue({ entryId: "selected-entry-123" });
    const ctx = createMockCtx();
    const handler = api.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);
    expect(mockNotify).toHaveBeenCalledWith("Selected entry: selected-entry-123", "info");
  });

  it("should notify when cancelled", async () => {
    const api = createMockApi();
    registerSessionTreeCommand(api);
    mockCustom.mockResolvedValue(null);
    const ctx = createMockCtx();
    const handler = api.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);
    expect(mockNotify).toHaveBeenCalledWith("Tree view closed", "info");
  });

  it("should handle empty tree", async () => {
    const api = createMockApi();
    registerSessionTreeCommand(api);
    const ctx = createMockCtx();
    ctx.sessionManager.getTree = () => [];
    const handler = api.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);
    expect(mockCustom).toHaveBeenCalled();
  });
});
