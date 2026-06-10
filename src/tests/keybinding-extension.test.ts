import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerKeybindingExtension } from "../extensions/keybinding/keybinding-extension.js";
import * as configManager from "../config/config-manager.js";

describe("Keybinding Extension", () => {
  let mockApi: any;
  let mockOn: any;
  let mockOnTerminalInput: vi.Mock;
  let unsubscribe: vi.Mock;
  let mockExecuteCommand: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOn = vi.fn();
    mockOnTerminalInput = vi.fn(() => unsubscribe);
    unsubscribe = vi.fn();
    mockExecuteCommand = vi.fn().mockResolvedValue(undefined);
    mockApi = {
      on: mockOn,
      executeCommand: mockExecuteCommand,
    };
  });

  it("registers session_start listener", () => {
    registerKeybindingExtension(mockApi);
    // Should register at least session_start
    const sessionStartCalls = mockOn.mock.calls.filter(c => c[0] === "session_start");
    expect(sessionStartCalls.length).toBeGreaterThan(0);
  });

  it("sets up keybindings from config and executes command on matching key", async () => {
    // Mock loadConfig to return keybindings
    vi.spyOn(configManager, "loadConfig").mockReturnValue({
      keybindings: { team: "t", settings: "ctrl+s" },
    } as any);

    registerKeybindingExtension(mockApi);
    // Get the session_start handler
    const sessionStartCall = mockOn.mock.calls.find(c => c[0] === "session_start");
    expect(sessionStartCall).toBeDefined();
    const handler = sessionStartCall![1];

    // Mock context
    const mockOnTerminal = vi.fn().mockReturnValue(unsubscribe);
    const ctx = {
      isIdle: () => true,
      mode: "tui",
      ui: { onTerminalInput: mockOnTerminal },
    } as any;

    // Invoke handler
    await handler(null, ctx);

    // Verify onTerminalInput called
    expect(mockOnTerminal).toHaveBeenCalledTimes(1);
    const inputHandler = mockOnTerminal.mock.calls[0][0];

    // Simulate pressing 't'
    inputHandler("t");
    expect(mockExecuteCommand).toHaveBeenCalledWith("team", "");

    // Simulate ctrl+s (ASCII 19, which is \u0013)
    inputHandler(String.fromCharCode(19));
    expect(mockExecuteCommand).toHaveBeenCalledWith("settings", "");
  });

  it("does not execute command when agent is not idle", async () => {
    vi.spyOn(configManager, "loadConfig").mockReturnValue({
      keybindings: { team: "t" },
    } as any);

    registerKeybindingExtension(mockApi);
    const sessionStartCall = mockOn.mock.calls.find(c => c[0] === "session_start");
    const handler = sessionStartCall![1];

    const mockOnTerminal = vi.fn().mockReturnValue(unsubscribe);
    const ctx = {
      isIdle: () => false, // not idle
      mode: "tui",
      ui: { onTerminalInput: mockOnTerminal },
    } as any;

    await handler(null, ctx);
    const inputHandler = mockOnTerminal.mock.calls[0][0];

    // Simulate press
    inputHandler("t");
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it("ignores keys with no binding", async () => {
    vi.spyOn(configManager, "loadConfig").mockReturnValue({
      keybindings: { team: "t" },
    } as any);

    registerKeybindingExtension(mockApi);
    const sessionStartCall = mockOn.mock.calls.find(c => c[0] === "session_start");
    const handler = sessionStartCall![1];

    const mockOnTerminal = vi.fn().mockReturnValue(unsubscribe);
    const ctx = {
      isIdle: () => true,
      mode: "tui",
      ui: { onTerminalInput: mockOnTerminal },
    } as any;

    await handler(null, ctx);
    const inputHandler = mockOnTerminal.mock.calls[0][0];

    // Simulate 'x'
    inputHandler("x");
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });
});
