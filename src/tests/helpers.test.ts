import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fs and path before helpers import
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...segments: string[]) => segments.join('/')),
  dirname: vi.fn(() => '/agent'),
}));

vi.mock('chalk', () => ({
  default: {
    yellow: (text: string) => text,
  },
}));

// Now import the helpers
import { ensurePiclawExtensionRegistered, validateApiKeys } from '../utils/helpers.js';
import * as fs from 'node:fs';

describe('ensurePiclawExtensionRegistered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.existsSync as any).mockReturnValue(false);
    (fs.mkdirSync as any).mockImplementation(() => {});
    (fs.writeFileSync as any).mockImplementation(() => {});
  });

  it('creates settings file when none exists', async () => {
    (fs.existsSync as any).mockReturnValue(false);
    await ensurePiclawExtensionRegistered('/agent', '/path/to/ext.js');
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/agent/settings.json',
      expect.stringContaining('ext.js'),
      'utf-8'
    );
  });

  it('adds extension when array exists but does not include it', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(JSON.stringify({ extensions: ['other.js'] }));
    await ensurePiclawExtensionRegistered('/agent', '/ext.js');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/agent/settings.json',
      expect.stringContaining('ext.js'),
      'utf-8'
    );
  });

  it('does nothing when extension already registered', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(JSON.stringify({ extensions: ['/ext.js'] }));
    await ensurePiclawExtensionRegistered('/agent', '/ext.js');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('handles writeFile error without throwing', async () => {
    (fs.existsSync as any).mockReturnValue(false);
    (fs.writeFileSync as any).mockImplementation(() => { throw new Error('disk full'); });
    await ensurePiclawExtensionRegistered('/agent', '/ext.js');
  });

  it('handles invalid JSON in settings file', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue('invalid json');
    await ensurePiclawExtensionRegistered('/agent', '/ext.js');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('creates extensions array if missing', async () => {
    (fs.existsSync as any).mockReturnValue(false);
    await ensurePiclawExtensionRegistered('/agent', '/ext.js');
    const written = (fs.writeFileSync as any).mock.calls[0][1];
    const settings = JSON.parse(written);
    expect(Array.isArray(settings.extensions)).toBe(true);
    expect(settings.extensions).toContain('/ext.js');
  });
});

describe('validateApiKeys', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Clear env
    delete process.env.KILO_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('shows warning for missing ANTHROPIC_API_KEY', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = { model: 'anthropic:claude-3' } as any;
    validateApiKeys(config);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('ANTHROPIC_API_KEY'));
    spy.mockRestore();
  });

  it('shows warning for missing OPENAI_API_KEY', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = { model: 'openai:gpt-4' } as any;
    validateApiKeys(config);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('OPENAI_API_KEY'));
    spy.mockRestore();
  });

  it('shows warning for missing KILO_API_KEY', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = { model: 'kilo:some-model' } as any;
    validateApiKeys(config);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('KILO_API_KEY'));
    spy.mockRestore();
  });

  it('does not warn when API key exists', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.ANTHROPIC_API_KEY = 'dummy';
    const config = { model: 'anthropic:claude-3' } as any;
    validateApiKeys(config);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not warn when no model specified', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = {} as any;
    validateApiKeys(config);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
