import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerSettingsCommand } from "../extensions/commands/settings-command.js";

// Mock config manager completely (no direct import)
vi.mock("../../config/config-manager.js", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

// Mock external TUI dependencies
vi.mock("@earendil-works/pi-tui", () => ({
  Container: class Container {
    addChild() {}
    render() { return []; }
    invalidate() {}
  },
  Text: class Text { constructor(public content: string) {} },
  Spacer: class Spacer {},
  SettingsList: class SettingsList {
    constructor() {}
    handleInput() {}
  },
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getSettingsListTheme: () => ({}),
}));

const mockNotify = vi.fn();
const mockCustom = vi.fn();

const createMockCtx = (overrides = {}) => ({
  ui: {
    notify: mockNotify,
    custom: mockCustom,
    get getAllThemes() { return []; },
    getTheme: () => undefined,
    setTheme: () => ({ success: false }),
  },
  mode: "tui",
  hasUI: true,
  ...overrides,
});

const createMockApi = () => ({ registerCommand: vi.fn() });

describe("Settings Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register command correctly", () => {
    const api = createMockApi();
    registerSettingsCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith("settings", expect.any(Object));
  });

  it("should require TUI mode", async () => {
    const api = createMockApi();
    registerSettingsCommand(api);
    const ctx = createMockCtx({ hasUI: false });

    const handler = api.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockNotify).toHaveBeenCalledWith("/settings requires TUI mode", "error");
    expect(mockCustom).not.toHaveBeenCalled();
  });

  it("should proceed in TUI mode", async () => {
    const api = createMockApi();
    registerSettingsCommand(api);
    const ctx = createMockCtx();

    const handler = api.registerCommand.mock.calls[0][1].handler;
    await handler("", ctx);

    expect(mockCustom).toHaveBeenCalled();
  });
});
