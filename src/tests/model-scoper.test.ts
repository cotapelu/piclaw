import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setupModelScoping,
  resolveModelPattern,
  getAllModels,
  getScopedModelByIndex,
  findScopedModelIndex,
  type ScopedModel,
} from "../model-scoper";
import * as modelScoperModule from "../model-scoper";
import type { Model } from "@earendil-works/pi-ai";
import { modelsAreEqual } from "@earendil-works/pi-ai";
import { logger } from "../utils/logger.js";

// Helper to create mock model
function mockModel(provider: string, id: string): Model {
  return {
    provider,
    id,
    cost: { input: 0, output: 0 },
    features: {},
    payment: { type: "paygo" },
    maxPrice: { input: 0, output: 0 },
    rates: { input: 0, output: 0 },
  } as Model;
}

describe("ModelScoper", () => {
  let mockRegistry: any;
  let mockSettings: any;
  let mockModels: Model[];

  beforeEach(() => {
    // Create a set of models for testing
    mockModels = [
      mockModel("anthropic", "claude-3-opus-20240229"),
      mockModel("anthropic", "claude-3-sonnet-20240229"),
      mockModel("anthropic", "claude-3-haiku-20240307"),
      mockModel("openai", "gpt-4-turbo-preview"),
      mockModel("openai", "gpt-4-1106-preview"),
      mockModel("openai", "gpt-3.5-turbo"),
      mockModel("kilo", "claude-3-opus-20240229"), // duplicate id across providers
    ];

    mockRegistry = {
      getAll: vi.fn(() => mockModels),
      find: vi.fn((provider: string, id: string) =>
        mockModels.find((m) => m.provider === provider && m.id === id)
      ),
    };

    mockSettings = {
      getEnabledModels: vi.fn(() => ["*"]), // default: all
      getDefaultProvider: vi.fn(() => "openai"),
      getDefaultModel: vi.fn(() => "gpt-4-turbo-preview"),
    };
  });

  describe("getAllModels", () => {
    it("returns all models from registry", () => {
      const all = getAllModels(mockRegistry);
      expect(all).toHaveLength(mockModels.length);
    });
  });

  describe("resolveModelPattern", () => {
    it("matches exact provider:model", () => {
      const matches = resolveModelPattern("openai:gpt-4-turbo-preview", mockModels);
      expect(matches).toHaveLength(1);
      expect(matches[0].provider).toBe("openai");
    });

    it("matches with wildcard *", () => {
      const matches = resolveModelPattern("anthropic:*", mockModels);
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it("matches partial id with minimatch", () => {
      const matches = resolveModelPattern("gpt-4*", mockModels);
      expect(matches.some((m) => m.id.includes("gpt-4"))).toBe(true);
    });

    it("matches case insensitive", () => {
      const matches = resolveModelPattern("OPENAI:*", mockModels);
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it("handles slash-less pattern (search in id)", () => {
      const matches = resolveModelPattern("claude", mockModels);
      expect(matches.filter((m) => m.id.includes("claude")).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("setupModelScoping - basic", () => {
    it("returns scoped list based on enabled patterns", async () => {
      mockSettings.getEnabledModels = vi.fn(() => ["anthropic:*", "openai:gpt-4*"]);
      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });

      // Should have anthropic models + gpt-4 models
      expect(result.scopedModels.length).toBeGreaterThan(2);
      expect(result.scopedModels.every((sm: ScopedModel) =>
        sm.model.provider === "anthropic" || sm.model.provider === "openai"
      )).toBe(true);
    });

    it("deduplicates models", async () => {
      // Both patterns may overlap
      mockSettings.getEnabledModels = vi.fn(() => ["*", "openai:*"]);
      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });

      // Count unique model+provider combos
      const ids = result.scopedModels.map((sm: ScopedModel) => `${sm.model.provider}/${sm.model.id}`);
      const unique = new Set(ids);
      expect(unique.size).toBe(result.scopedModels.length);
    });

    it("extracts thinking level from pattern suffix", async () => {
      mockSettings.getEnabledModels = vi.fn(() => ["anthropic:claude-3-opus:high"]);
      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });

      const claudeOpus = result.scopedModels.find((sm: ScopedModel) =>
        sm.model.provider === "anthropic" && sm.model.id.includes("opus")
      );
      expect(claudeOpus).toBeDefined();
      expect(claudeOpus?.thinkingLevel).toBe("high");
    });

    it("falls back to all models if no matches", async () => {
      mockSettings.getEnabledModels = vi.fn(() => ["nonexistent:*"]);
      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });

      expect(result.scopedModels.length).toBe(mockModels.length);
    });

    it("skips empty patterns and logs warning", async () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      mockSettings.getEnabledModels = vi.fn(() => ["", "  ", "anthropic:*"]);
      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Empty model pattern"));
      expect(result.scopedModels.length).toBeGreaterThanOrEqual(3);
    });



  });

  describe("setupModelScoping - limit (MAX=50)", () => {
    it("limits to 50 scoped models when exceeding", async () => {
      // Simulate 100 models
      const manyModels: Model[] = Array.from({ length: 100 }, (_, i) =>
        mockModel(`provider${i % 10}`, `model-${i}`)
      );
      mockRegistry.getAll = vi.fn(() => manyModels);
      mockSettings.getEnabledModels = vi.fn(() => ["*"]);
      mockSettings.getDefaultProvider = vi.fn(() => "provider0");
      mockSettings.getDefaultModel = vi.fn(() => "model-0");

      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });

      expect(result.scopedModels.length).toBe(50);
    });

    it("prioritizes default model in limited list", async () => {
      const manyModels: Model[] = Array.from({ length: 100 }, (_, i) =>
        mockModel(`provider${i % 10}`, `model-${i}`)
      );
      mockRegistry.getAll = vi.fn(() => manyModels);
      // Override find to search in manyModels
      mockRegistry.find = vi.fn((provider: string, id: string) =>
        manyModels.find(m => m.provider === provider && m.id === id)
      );
      mockSettings.getEnabledModels = vi.fn(() => ["*"]);
      mockSettings.getDefaultProvider = vi.fn(() => "provider1");
      // Choose a model that exists in provider1: model-1, model-11, etc.
      mockSettings.getDefaultModel = vi.fn(() => "model-1");

      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });

      // Default model should be included and near the front (index 0)
      const idx = result.scopedModels.findIndex(
        (sm: ScopedModel) => sm.model.provider === "provider1" && sm.model.id === "model-1"
      );
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(5); // high priority
    });
  });

  describe("setupModelScoping - active model selection", () => {
    it("selects CLI override as active", async () => {
      mockSettings.getEnabledModels = vi.fn(() => ["*"]);
      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: "anthropic:claude-3-haiku-20240307",
        cliThinking: "medium",
        currentSessionHasModel: false,
      });

      expect(result.model).toBeDefined();
      expect(result.model?.model.provider).toBe("anthropic");
      expect(result.model?.model.id).toBe("claude-3-haiku-20240307");
      expect(result.model?.thinkingLevel).toBe("medium");
    });

    it("uses default model from settings if no CLI", async () => {
      mockSettings.getEnabledModels = vi.fn(() => ["*"]);
      mockSettings.getDefaultProvider = vi.fn(() => "openai");
      mockSettings.getDefaultModel = vi.fn(() => "gpt-4-turbo-preview");

      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });

      expect(result.model?.model.provider).toBe("openai");
      expect(result.model?.model.id).toBe("gpt-4-turbo-preview");
    });

    it("falls back to first scoped model", async () => {
      mockSettings.getEnabledModels = vi.fn(() => ["openai:gpt-3.5-turbo"]);
      mockSettings.getDefaultProvider = vi.fn(() => undefined);
      mockSettings.getDefaultModel = vi.fn(() => undefined);

      const result = await setupModelScoping({
        modelRegistry: mockRegistry,
        settingsManager: mockSettings,
        cliModel: undefined,
        cliThinking: undefined,
        currentSessionHasModel: false,
      });

      expect(result.model).toBeDefined();
      expect(result.model?.model.id).toBe("gpt-3.5-turbo");
    });
  });

  describe("getScopedModelByIndex", () => {
    it("returns model at positive index", () => {
      const scoped: ScopedModel[] = [
        { model: mockModel("p1", "m1") },
        { model: mockModel("p2", "m2") },
      ];
      expect(getScopedModelByIndex(scoped, 0)?.model.id).toBe("m1");
      expect(getScopedModelByIndex(scoped, 1)?.model.id).toBe("m2");
    });

    it("wraps negative index", () => {
      const scoped: ScopedModel[] = [
        { model: mockModel("p1", "m1") },
        { model: mockModel("p2", "m2") },
      ];
      expect(getScopedModelByIndex(scoped, -1)?.model.id).toBe("m2");
      expect(getScopedModelByIndex(scoped, -2)?.model.id).toBe("m1");
    });

    it("handles empty list", () => {
      expect(getScopedModelByIndex([], 0)).toBeUndefined();
    });
  });

  describe("findScopedModelIndex", () => {
    it("finds index of model", () => {
      const models: ScopedModel[] = [
        { model: mockModel("a", "1") },
        { model: mockModel("b", "2") },
      ];
      expect(findScopedModelIndex(models, mockModel("b", "2"))).toBe(1);
    });

    it("returns -1 if not found", () => {
      const models: ScopedModel[] = [
        { model: mockModel("a", "1") },
      ];
      expect(findScopedModelIndex(models, mockModel("x", "9"))).toBe(-1);
    });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  });
});
