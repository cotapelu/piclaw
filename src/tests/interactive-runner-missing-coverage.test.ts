import { vi, describe, it, expect, beforeEach } from 'vitest';
import { runInteractive } from '../interactive-runner.js';
import { logger } from '../utils/logger.js';

// Configurable mock state
let mockKeybindings: any = null;
let mockRunReturn: any = Promise.resolve();
let constructorArgs: [any, any] | null = null;

vi.mock('@earendil-works/pi-coding-agent', () => {
  return {
    InteractiveMode: class {
      runtime: any;
      options: any;
      run: any;
      keybindings: any;
      constructor(runtime: any, options: any) {
        this.runtime = runtime;
        this.options = options;
        constructorArgs = [runtime, options];
        // Setup run method (can be overridden by mockRunReturn)
        this.run = vi.fn(() => mockRunReturn);
        // Setup keybindings if provided
        this.keybindings = mockKeybindings;
      }
    },
  };
});

describe('runInteractive edge cases', () => {
  beforeEach(() => {
    mockKeybindings = null;
    mockRunReturn = Promise.resolve();
    constructorArgs = null;
    vi.clearAllMocks();
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  it('sets Ctrl+R binding when keybindings present and no binding', async () => {
    const setUserBindings = vi.fn();
    mockKeybindings = {
      getUserBindings: () => ({}),
      setUserBindings,
    };
    const mockRuntime = { session: {} } as any;
    await runInteractive(mockRuntime, { verbose: true });

    expect(setUserBindings).toHaveBeenCalledWith({
      'app.session.resume': 'ctrl+r',
    });
  });

  it('does not set binding if already user-defined', async () => {
    mockKeybindings = {
      getUserBindings: () => ({ 'app.session.resume': 'ctrl+shift+r' }),
      setUserBindings: vi.fn(),
    };
    await runInteractive({} as any, {});

    expect(mockKeybindings.setUserBindings).not.toHaveBeenCalled();
  });

  it('does not set binding if setUserBindings is not a function', async () => {
    mockKeybindings = {
      getUserBindings: () => ({}),
      setUserBindings: 'not a function',
    };
    await expect(runInteractive({} as any, {})).resolves.not.toThrow();
    // Should have skipped set
  });

  it('does not crash if keybindings is undefined', async () => {
    mockKeybindings = undefined;
    await expect(runInteractive({} as any, {})).resolves.not.toThrow();
  });

  it('catches getUserBindings exception and logs debug', async () => {
    const setUserBindings = vi.fn();
    mockKeybindings = {
      getUserBindings: () => {
        throw new Error('get fail');
      },
      setUserBindings,
    };
    const debugSpy = vi.spyOn(logger, 'debug');

    await expect(runInteractive({} as any, {})).resolves.not.toThrow();

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not set Ctrl+R binding')
    );
    expect(setUserBindings).not.toHaveBeenCalled();
  });

  it('catches setUserBindings exception and logs debug', async () => {
    mockKeybindings = {
      getUserBindings: () => ({}),
      setUserBindings: () => {
        throw new Error('set fail');
      },
    };
    const debugSpy = vi.spyOn(logger, 'debug');

    await expect(runInteractive({} as any, {})).resolves.not.toThrow();

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not set Ctrl+R binding')
    );
  });

  it('logs existing user binding with proper format', async () => {
    mockKeybindings = {
      getUserBindings: () => ({ 'app.session.resume': 'ctrl+r' }),
      setUserBindings: vi.fn(),
    };
    const debugSpy = vi.spyOn(logger, 'debug');

    await runInteractive({} as any, {});

    expect(debugSpy).toHaveBeenCalledWith(
      'Session selector using user binding: ctrl+r'
    );
  });

  it('logs existing array binding with comma-separated keys', async () => {
    mockKeybindings = {
      getUserBindings: () => ({ 'app.session.resume': ['ctrl+r', 'ctrl+shift+r'] }),
      setUserBindings: vi.fn(),
    };
    const debugSpy = vi.spyOn(logger, 'debug');

    await runInteractive({} as any, {});

    expect(debugSpy).toHaveBeenCalledWith(
      'Session selector using user binding: ctrl+r, ctrl+shift+r'
    );
  });

  it('propagates rejection from interactive.run()', async () => {
    mockRunReturn = Promise.reject(new Error('runtime failure'));
    await expect(runInteractive({} as any, {})).rejects.toThrow('runtime failure');
  });

  it('passes options correctly to InteractiveMode', async () => {
    await runInteractive({ session: {} } as any, {
      verbose: true,
      initialMessage: 'test',
      initialImages: [{ type: 'image' }],
    });
    expect(constructorArgs).not.toBeNull();
    expect(constructorArgs![1]).toEqual({
      verbose: true,
      initialMessage: 'test',
      initialImages: [{ type: 'image' }],
    });
  });

  it('uses default options when none provided', async () => {
    await runInteractive({} as any, undefined);
    expect(constructorArgs).not.toBeNull();
    expect(constructorArgs![1]).toEqual({ verbose: false });
  });
});
