#!/usr/bin/env node

/**
 * Model Scoper
 *
 * Resolves which model to use and builds scoped model list for Ctrl+P cycling.
 * Uses only public API: ModelRegistry.getAll(), ModelRegistry.find(), modelsAreEqual().
 */

import { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { Model } from "@earendil-works/pi-ai";
import { modelsAreEqual } from "@earendil-works/pi-ai";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { logger } from "./utils/logger.js";
import { minimatch } from "minimatch";

/**
 * Scoped model: model + optional thinking level override
 */
export interface ScopedModel {
  model: Model<any>;
  thinkingLevel?: ThinkingLevel;
}

/**
 * Options for model scoping
 */
export interface ModelScopingOptions {
  modelRegistry: ModelRegistry;
  settingsManager: import("@earendil-works/pi-coding-agent").SettingsManager;
  cliModel?: string;
  cliThinking?: ThinkingLevel;
  currentSessionHasModel: boolean;
}

/**
 * Get all available models from registry
 */
export function getAllModels(registry: ModelRegistry): Model<any>[] {
  return registry.getAll();
}

/**
 * Check if a model matches a pattern
 */
function modelMatchesPattern(model: Model<any>, pattern: string): boolean {
  const patternLower = pattern.toLowerCase();

  if (pattern.includes("/")) {
    const [provider, modelId] = pattern.split("/", 2);
    if (provider && modelId) {
      return model.provider.toLowerCase() === provider.toLowerCase() &&
             model.id.toLowerCase().includes(modelId.toLowerCase());
    }
  }

  return minimatch(model.id.toLowerCase(), patternLower, { matchBase: true }) ||
         model.id.toLowerCase().includes(patternLower.replace(/\*/g, ''));
}

/**
 * Resolve model pattern to actual model(s)
 */
export function resolveModelPattern(
  pattern: string,
  allModels: Model<any>[]
): Model<any>[] {
  return allModels.filter(model => modelMatchesPattern(model, pattern));
}

/**
 * Get default model from settings
 */
function getDefaultModelFromSettings(
  registry: ModelRegistry,
  settingsManager: import("@earendil-works/pi-coding-agent").SettingsManager
): Model<any> | undefined {
  const defaultProvider = settingsManager.getDefaultProvider?.();
  const defaultModelId = settingsManager.getDefaultModel?.();

  if (!defaultProvider || !defaultModelId) {
    return undefined;
  }

  return registry.find(defaultProvider, defaultModelId);
}

/**
 * Main scoping function
 */
export async function setupModelScoping(
  opts: ModelScopingOptions
): Promise<{
  model?: ScopedModel;
  scopedModels: ScopedModel[];
}> {
  const { modelRegistry, settingsManager, cliModel, cliThinking, currentSessionHasModel } = opts;

  logger.debug("Setting up model scoping", { cliModel, cliThinking, currentSessionHasModel });

  // 1. Get all available models
  const allModels = getAllModels(modelRegistry);
  if (allModels.length === 0) {
    logger.warn("No models available in registry");
    return { model: undefined, scopedModels: [] };
  }

  // 2. Get enabled model patterns from settings
  const enabledPatterns = settingsManager.getEnabledModels?.() || [];

  // 3. Resolve patterns to actual models (build scoped list)
  let scopedModels: ScopedModel[] = [];

  if (enabledPatterns && enabledPatterns.length > 0) {
    for (const pattern of enabledPatterns) {
      let patternClean = pattern;
      let thinkingLevel: ThinkingLevel | undefined;

      const colonIndex = pattern.lastIndexOf(":");
      if (colonIndex !== -1) {
        const suffix = pattern.slice(colonIndex + 1);
        const validLevels: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];
        if (validLevels.includes(suffix as ThinkingLevel)) {
          thinkingLevel = suffix as ThinkingLevel;
          patternClean = pattern.slice(0, colonIndex);
        }
      }

      const matches = resolveModelPattern(patternClean, allModels);
      for (const model of matches) {
        const existing = scopedModels.find(sm => modelsAreEqual(sm.model, model));
        if (!existing) {
          scopedModels.push({ model, thinkingLevel });
        }
      }
    }
  }

  // Nếu không có enabled patterns, hoặc scoped list rỗng, dùng tất cả models
  if (scopedModels.length === 0) {
    const allScoped: ScopedModel[] = allModels.map(m => ({ model: m }));
    logger.warn(`No models matched enabled patterns, falling back to all ${allModels.length} models`);
    scopedModels = allScoped;
  }

  // 🔥 LIMIT: Giới hạn scoped models để tránh UI hỏng
  const MAX_SCOPED_MODELS = 50;
  if (scopedModels.length > MAX_SCOPED_MODELS) {
    const defaultProvider = settingsManager.getDefaultProvider?.();
    const defaultModelId = settingsManager.getDefaultModel?.();
    const defaultModel = defaultProvider && defaultModelId
      ? modelRegistry.find(defaultProvider, defaultModelId)
      : undefined;

    // Tìm current model từ session nếu có
    let currentModel: Model<any> | undefined;
    if (currentSessionHasModel) {
      // Lấy model hiện tại từ runtime (không có ở đây, nên dùng default)
      currentModel = defaultModel;
    }

    // Phân loại: prioritize current + default
    const prioritized: ScopedModel[] = [];
    const seenIds = new Set<string>();

    // Thêm current model trước (nếu có)
    if (currentModel) {
      const found = scopedModels.find(sm => modelsAreEqual(sm.model, currentModel));
      if (found && !seenIds.has(found.model.id)) {
        prioritized.push(found);
        seenIds.add(found.model.id);
      }
    }

    // Thêm default model (nếu khác current)
    if (defaultModel) {
      const found = scopedModels.find(sm => modelsAreEqual(sm.model, defaultModel));
      if (found && !seenIds.has(found.model.id)) {
        prioritized.push(found);
        seenIds.add(found.model.id);
      }
    }

    // Thêm các model còn lại cho đến đủ MAX
    for (const sm of scopedModels) {
      if (prioritized.length >= MAX_SCOPED_MODELS) break;
      if (!seenIds.has(sm.model.id)) {
        prioritized.push(sm);
        seenIds.add(sm.model.id);
      }
    }

    const originalCount = scopedModels.length;
    scopedModels = prioritized;
    logger.warn(`Limited scoped models from ${originalCount} to ${scopedModels.length} (keep current+default)`);
  }

  // 4. Determine active model
  let activeScopedModel: ScopedModel | undefined;

  // CLI override
  if (cliModel) {
    const cliMatches = resolveModelPattern(cliModel, allModels);
    if (cliMatches.length > 0) {
      activeScopedModel = { model: cliMatches[0], thinkingLevel: cliThinking };
      logger.debug(`CLI override model: ${cliModel} -> ${cliMatches[0].provider}/${cliMatches[0].id}`);
    }
  }

  // Session already has model?
  if (!activeScopedModel && currentSessionHasModel) {
    const sessionProvider = settingsManager.getDefaultProvider?.();
    const sessionModelId = settingsManager.getDefaultModel?.();
    if (sessionProvider && sessionModelId) {
      const sessionModel = modelRegistry.find(sessionProvider, sessionModelId);
      if (sessionModel) {
        activeScopedModel = scopedModels.find(sm => modelsAreEqual(sm.model, sessionModel)) || { model: sessionModel };
        logger.debug(`Using session's model: ${sessionProvider}/${sessionModelId}`);
      }
    }
  }

  // Use default from settings
  if (!activeScopedModel) {
    const defaultModel = getDefaultModelFromSettings(modelRegistry, settingsManager);
    if (defaultModel) {
      const found = scopedModels.find(sm => modelsAreEqual(sm.model, defaultModel));
      if (found) {
        activeScopedModel = found;
      } else {
        activeScopedModel = { model: defaultModel };
      }
      logger.debug(`Using default model from settings: ${defaultModel.provider}/${defaultModel.id}`);
    }
  }

  // Fallback: first scoped model
  if (!activeScopedModel && scopedModels.length > 0) {
    activeScopedModel = scopedModels[0];
    logger.debug(`Using first scoped model: ${activeScopedModel.model.provider}/${activeScopedModel.model.id}`);
  }

  logger.debug(
    "Model scoping result",
    { activeModel: activeScopedModel?.model.id, scopedCount: scopedModels.length }
  );

  return {
    model: activeScopedModel,
    scopedModels,
  };
}

/**
 * Helper: Get scoped model by index (for cycling)
 */
export function getScopedModelByIndex(
  scopedModels: ScopedModel[],
  index: number
): ScopedModel | undefined {
  if (scopedModels.length === 0) return undefined;
  const normalizedIndex = ((index % scopedModels.length) + scopedModels.length) % scopedModels.length;
  return scopedModels[normalizedIndex];
}

/**
 * Find scoped model index by model reference
 */
export function findScopedModelIndex(
  scopedModels: ScopedModel[],
  model: Model<any>
): number {
  for (let i = 0; i < scopedModels.length; i++) {
    if (modelsAreEqual(scopedModels[i].model, model)) {
      return i;
    }
  }
  return -1;
}
