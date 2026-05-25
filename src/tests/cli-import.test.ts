import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock main before cli is imported.
vi.mock('../main.js', () => ({
  main: vi.fn().mockResolvedValue(undefined),
  __esModule: true,
}));

import { main as mockedMain } from '../main.js';

describe('cli module (../cli.js)', () => {
  let exitSpy: any;

  beforeEach(() => {
    // Reset process modifications
    delete (process.env as any).PI_CODING_AGENT;
    process.title = 'node';
    // Spy on process.exit to prevent actual exit and track calls
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      // Do nothing, but return a value cast to never to satisfy type
      return undefined as any;
    });
    // Spy on console.error to reduce noise and allow verification if needed
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy?.mockRestore();
    vi.restoreAllMocks();
  });

  it('should set process.title and env var on module load', async () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'piclaw', '--cwd', '/tmp', '--verbose'];

    await import('../cli.js');

    expect(process.title).toBe('piclaw');
    expect(process.env.PI_CODING_AGENT).toBe('true');

    expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0);
    expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0);

    expect(mockedMain).toHaveBeenCalledTimes(1);
    expect(mockedMain.mock.calls[0][0]).toEqual(['--cwd', '/tmp', '--verbose']);

    process.argv = originalArgv;
  });

  it('handles unhandledRejection by exiting with code 1', async () => {
    await import('../cli.js'); // ensure cli is loaded
    process.emit('unhandledRejection', new Error('test rejection'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('handles uncaughtException by exiting with code 1', async () => {
    await import('../cli.js');
    process.emit('uncaughtException', new Error('test exception'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
