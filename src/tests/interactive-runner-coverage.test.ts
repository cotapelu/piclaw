import { vi, describe, it, expect, beforeEach } from 'vitest';

// Variables to track constructor calls and instances
let interactiveCtorCalls: Array<[any, any]> = [];
let interactiveInstances: any[] = [];

// Mock the entire module
vi.mock('@earendil-works/pi-coding-agent', () => {
  return {
    InteractiveMode: class {
      runtime: any;
      options: any;
      run: any;
      constructor(runtime: any, options: any) {
        interactiveInstances.push(this);
        interactiveCtorCalls.push([runtime, options]);
        this.runtime = runtime;
        this.options = options;
        this.run = vi.fn().mockResolvedValue(undefined);
      }
    },
  };
});

import { runInteractive } from '../interactive-runner.js';

describe('interactive-runner', () => {
  beforeEach(() => {
    interactiveCtorCalls = [];
    interactiveInstances = [];
    vi.clearAllMocks();
  });

  it('should instantiate InteractiveMode with runtime and options, then call run', async () => {
    const mockRuntime = { session: {} } as any;
    const options = { verbose: true };
    await runInteractive(mockRuntime, options);
    expect(interactiveCtorCalls).toHaveLength(1);
    expect(interactiveCtorCalls[0][0]).toBe(mockRuntime);
    expect(interactiveCtorCalls[0][1]).toEqual({ verbose: true });
    const instance = interactiveInstances[0];
    expect(instance.run).toHaveBeenCalledTimes(1);
  });

  it('should use default options when none provided', async () => {
    const mockRuntime = {} as any;
    await runInteractive(mockRuntime);
    expect(interactiveCtorCalls).toHaveLength(1);
    expect(interactiveCtorCalls[0][1]).toEqual({ verbose: false });
  });
});
