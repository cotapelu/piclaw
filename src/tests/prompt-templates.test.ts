import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';

// Mock external SDK and local modules
vi.mock('@earendil-works/pi-coding-agent', async () => {
  // Create spies for inspection
  const createAgentSessionServices = vi.fn().mockResolvedValue({
    cwd: '',
    agentDir: '',
    settingsManager: {
      get: () => undefined,
      set: () => {},
      delete: () => {},
      getAll: () => ({}),
      subscribe: () => () => {},
      getDefaultProvider: () => undefined,
      getDefaultModel: () => undefined,
    },
    modelRegistry: {
      getAll: () => [],
      find: () => undefined,
    },
    diagnostics: [],
    resourceLoader: {
      loadPromptTemplate: async () => ({ content: '', variables: [] }),
    },
  } as any);

  const createAgentSessionFromServices = vi.fn().mockImplementation(async ({ sessionManager }) => ({
    cwd: 'mocked-runtime-cwd',
    session: {
      sessionManager,
      setScopedModels: () => {},
      setModel: async () => {},
      setThinkingLevel: () => {},
      model: undefined,
    },
  } as any));

  const createAgentSessionRuntime = vi.fn().mockImplementation(async (factory, options) => {
    const result = await factory({
      cwd: options.cwd,
      agentDir: options.agentDir,
      sessionManager: options.sessionManager,
      sessionStartEvent: options.sessionStartEvent,
    });
    if (!result.cwd) result.cwd = options.cwd;
    return result;
  });

  return {
    SettingsManager: {
      create: vi.fn().mockReturnValue({
        get: () => undefined,
        set: () => {},
        delete: () => {},
        getAll: () => ({}),
        subscribe: () => () => {},
        getDefaultProvider: () => undefined,
        getDefaultModel: () => undefined,
      }),
    },
    createAgentSessionServices,
    createAgentSessionFromServices,
    createAgentSessionRuntime,
  };
});

vi.mock('../session-resolver.js', async () => {
  return {
    resolveSessionManager: vi.fn().mockResolvedValue({
      getCurrentSession: () => null,
      getSessionId: () => 'test-session-id',
      createSession: () => ({}),
      resumeSession: () => ({}),
      continueSession: () => ({}),
      forkSession: () => ({}),
    }),
  };
});

vi.mock('../piclaw-package-manager.js', async () => {
  return {
    PiclawPackageManager: class {
      constructor(opts: any) {}
    },
  };
});

vi.mock('../extensions/index.js', async () => {
  const getResourceLoaderOptions = vi.fn().mockReturnValue({
    extensionFactories: [],
  });
  return {
    default: getResourceLoaderOptions,
    getResourceLoaderOptions,
  };
});

vi.mock('../model-scoper.js', async () => {
  return {
    setupModelScoping: vi.fn().mockResolvedValue({
      model: null,
      scopedModels: [],
    }),
  };
});

// Now import the function under test (after all mocks)
import { bootPiclaw } from '../piclaw-core.js';
import { createAgentSessionServices } from '@earendil-works/pi-coding-agent';

describe('Prompt Template System', () => {
  const tempCwd = '/tmp/piclaw-test-cwd';
  const tempAgentDir = '/tmp/piclaw-test-agent';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass additionalPromptTemplatePaths to createAgentSessionServices', async () => {
    await bootPiclaw({ cwd: tempCwd, agentDir: tempAgentDir, interactive: false });
    const servicesCall = (createAgentSessionServices as any).mock.calls[0][0];
    expect(servicesCall.resourceLoaderOptions).toEqual(
      expect.objectContaining({
        additionalPromptTemplatePaths: [join(tempCwd, '.pi', 'prompts')],
      })
    );
  });

  it('should include extensionFactories from getResourceLoaderOptions', async () => {
    await bootPiclaw({ cwd: tempCwd, agentDir: tempAgentDir, interactive: false });
    const servicesCall = (createAgentSessionServices as any).mock.calls[0][0];
    expect(servicesCall.resourceLoaderOptions).toEqual(
      expect.objectContaining({
        extensionFactories: expect.any(Array),
      })
    );
  });
});
