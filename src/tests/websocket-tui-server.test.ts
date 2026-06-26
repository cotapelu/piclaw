import { describe, it, expect } from 'vitest';
import { parseWebsocketArgs } from '../websocket-tui-server.js';

describe('parseWebsocketArgs', () => {
  it('should return disabled when no flag present', () => {
    const result = parseWebsocketArgs(['some', 'args']);
    expect(result.enabled).toBe(false);
    expect(result.remainingArgs).toEqual(['some', 'args']);
  });

  it('should enable with default port on --tui-websocket', () => {
    const result = parseWebsocketArgs(['--tui-websocket', 'arg1']);
    expect(result.enabled).toBe(true);
    expect(result.port).toBe(8080);
    expect(result.address).toBe('127.0.0.1');
    expect(result.token).toBeNull();
    expect(result.remainingArgs).toEqual(['arg1']);
  });

  it('should parse port from --tui-websocket=3000', () => {
    const result = parseWebsocketArgs(['--tui-websocket=3000']);
    expect(result.enabled).toBe(true);
    expect(result.port).toBe(3000);
    expect(result.remainingArgs).toEqual([]);
  });

  it('should parse port from --tui-port=4000', () => {
    const result = parseWebsocketArgs(['--tui-port=4000']);
    expect(result.enabled).toBe(true);
    expect(result.port).toBe(4000);
  });

  it('should parse address from --tui-address=0.0.0.0', () => {
    const result = parseWebsocketArgs(['--tui-websocket', '--tui-address=0.0.0.0']);
    expect(result.enabled).toBe(true);
    expect(result.address).toBe('0.0.0.0');
  });

  it('should parse token from --tui-token=secret123', () => {
    const result = parseWebsocketArgs(['--tui-token=secret123']);
    expect(result.enabled).toBe(true);
    expect(result.token).toBe('secret123');
  });

  it('should handle multiple flags and preserve other args', () => {
    const result = parseWebsocketArgs([
      '--tui-websocket=9000',
      '--tui-address=::1',
      '--tui-token=abc',
      '--model=anthropic:claude',
      '--session=my.session',
    ]);
    expect(result.enabled).toBe(true);
    expect(result.port).toBe(9000);
    expect(result.address).toBe('::1');
    expect(result.token).toBe('abc');
    expect(result.remainingArgs).toEqual(['--model=anthropic:claude', '--session=my.session']);
  });

  it('should ignore invalid port values and keep defaults', () => {
    const result = parseWebsocketArgs(['--tui-websocket=notanumber']);
    expect(result.enabled).toBe(true);
    expect(result.port).toBe(8080);
  });

  it('should ignore out-of-range port values', () => {
    const result = parseWebsocketArgs(['--tui-websocket=99999']);
    expect(result.enabled).toBe(true);
    expect(result.port).toBe(8080);
  });
});
