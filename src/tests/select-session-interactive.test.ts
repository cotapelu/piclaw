import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectSessionInteractive } from "../session-resolver";
import { promptWithDefault } from "../utils/prompt";

vi.mock("../utils/prompt", () => ({
  promptWithDefault: vi.fn(),
}));

describe("selectSessionInteractive", () => {
  const sessions = [
    { id: "abc123", path: "/cwd/.pi/agent/abc123.jsonl" },
    { id: "def456", path: "/cwd/.pi/agent/def456.jsonl" },
    { id: "ghi789", path: "/cwd/.pi/agent/ghi789.jsonl" },
  ];
  const cwd = "/cwd";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns path for valid selection", async () => {
    (promptWithDefault as any).mockResolvedValue("2");
    const result = await selectSessionInteractive(sessions, cwd);
    expect(result).toBe(sessions[1].path);
    expect(promptWithDefault).toHaveBeenCalledWith(
      "Select session (1-3), or press Enter to cancel: ",
      ""
    );
  });

  it("returns undefined when user presses enter (empty)", async () => {
    (promptWithDefault as any).mockResolvedValue("");
    const result = await selectSessionInteractive(sessions, cwd);
    expect(result).toBeUndefined();
  });

  it("returns undefined when user enters invalid then cancels? Actually if input is non-numeric, promptWithDefault returns string; the function parseInt, if NaN, returns undefined after invalid? It prints warning and returns undefined", async () => {
    (promptWithDefault as any).mockResolvedValue("xyz");
    const result = await selectSessionInteractive(sessions, cwd);
    expect(result).toBeUndefined();
  });

  it("returns undefined when selection out of range", async () => {
    (promptWithDefault as any).mockResolvedValue("5");
    const result = await selectSessionInteractive(sessions, cwd);
    expect(result).toBeUndefined();
  });
});
