import { describe, it, expect, beforeEach } from 'vitest';
import {
  setGlobalRuntime,
  getGlobalRuntime,
  clearGlobalRuntime,
} from '../runtime-runner.js';
import { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';

// Simple mock runtime for type assertions
const mockRuntime = {
  start: async () => {},
  stop: async () => {},
} as unknown as AgentSessionRuntime;

describe('runtime-runner', () => {
  beforeEach(() => {
    clearGlobalRuntime();
  });

  describe('setGlobalRuntime', () => {
    it('sets the global runtime', () => {
      expect(getGlobalRuntime()).toBeUndefined();
      setGlobalRuntime(mockRuntime);
      expect(getGlobalRuntime()).toBe(mockRuntime);
    });

    it('can overwrite the global runtime', () => {
      setGlobalRuntime(mockRuntime);
      const another = { ...mockRuntime } as AgentSessionRuntime;
      setGlobalRuntime(another);
      expect(getGlobalRuntime()).toBe(another);
    });
  });

  describe('getGlobalRuntime', () => {
    it('returns undefined when not set', () => {
      expect(getGlobalRuntime()).toBeUndefined();
    });

    it('returns the runtime after setGlobalRuntime', () => {
      setGlobalRuntime(mockRuntime);
      expect(getGlobalRuntime()).toBe(mockRuntime);
    });
  });

  describe('clearGlobalRuntime', () => {
    it('clears the global runtime', () => {
      setGlobalRuntime(mockRuntime);
      expect(getGlobalRuntime()).toBe(mockRuntime);
      clearGlobalRuntime();
      expect(getGlobalRuntime()).toBeUndefined();
    });

    it('is safe to call when already cleared', () => {
      clearGlobalRuntime();
      expect(getGlobalRuntime()).toBeUndefined();
      clearGlobalRuntime();
      expect(getGlobalRuntime()).toBeUndefined();
    });
  });
});
