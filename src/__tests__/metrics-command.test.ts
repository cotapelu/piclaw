import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerMetricsCommand } from "../extensions/commands/metrics-command.js";
import { toggleMetricsWidget, getMetricsWidgetEnabled } from "../extensions/metrics/metrics-widget.js";

// Mock metrics-widget
vi.mock("../extensions/metrics/metrics-widget.js", () => ({
  registerMetricsWidget: vi.fn(),
  toggleMetricsWidget: vi.fn(),
  getMetricsWidgetEnabled: vi.fn(),
}));

const mockNotify = vi.fn();

const createMockCtx = () => ({
  ui: {
    notify: mockNotify,
  },
});

const createMockApi = () => ({
  registerCommand: vi.fn(),
});

describe("Metrics Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerMetricsCommand", () => {
    it("should register command with correct name", () => {
      const api = createMockApi();
      registerMetricsCommand(api);
      expect(api.registerCommand).toHaveBeenCalledWith("metrics", expect.any(Object));
    });

    it("should toggle metrics widget and notify shown", async () => {
      getMetricsWidgetEnabled.mockReturnValue(false);
      toggleMetricsWidget.mockReturnValue(true);

      const api = createMockApi();
      registerMetricsCommand(api);
      const ctx = createMockCtx();

      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(toggleMetricsWidget).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith("Metrics widget shown", "info");
    });

    it("should toggle to false and notify hidden", async () => {
      getMetricsWidgetEnabled.mockReturnValue(true);
      toggleMetricsWidget.mockReturnValue(false);

      const api = createMockApi();
      registerMetricsCommand(api);
      const ctx = createMockCtx();

      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(toggleMetricsWidget).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith("Metrics widget hidden", "info");
    });
  });
});
