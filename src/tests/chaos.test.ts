#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chaos } from '../utils/chaos.js';

describe('Chaos Utility', () => {
  beforeEach(() => {
    delete process.env.PICLAW_CHAOS_RATE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw when Math.random() < rate', () => {
    process.env.PICLAW_CHAOS_RATE = '0.5';
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(() => chaos('test-op')).toThrow('[CHAOS] Simulated failure in test-op');
    randomSpy.mockRestore();
  });

  it('should NOT throw when Math.random() >= rate', () => {
    process.env.PICLAW_CHAOS_RATE = '0.5';
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(() => chaos('test-op')).not.toThrow();
    randomSpy.mockRestore();
  });

  it('should not throw when PICLAW_CHAOS_RATE is not set', () => {
    delete process.env.PICLAW_CHAOS_RATE;
    expect(() => chaos('test-op')).not.toThrow();
  });

  it('should respect rate 0 (never fail)', () => {
    process.env.PICLAW_CHAOS_RATE = '0';
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(() => chaos('test-op')).not.toThrow();
    randomSpy.mockRestore();
  });

  it('should always fail when rate is 1 and random < 1', () => {
    process.env.PICLAW_CHAOS_RATE = '1';
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(() => chaos('test-op')).toThrow('[CHAOS]');
    randomSpy.mockRestore();
  });
});
