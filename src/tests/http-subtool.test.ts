#!/usr/bin/env node

/**
 * Unit tests for http sub-tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHttp, httpSchema } from '../extensions/tools/sub-tools/http.ts';

// Mock exec result
const mockExecResult = (stdout: string = '', stderr: string = '', code: number = 0, killed: boolean = false) => ({
  stdout,
  stderr,
  code,
  killed,
});

// Mock context with mocked exec
function createMockContext() {
  const exec = vi.fn();
  return { exec };
}

describe('http sub-tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext();
  });

  it('should have correct schema', () => {
    expect(httpSchema.type).toBe('object');
    expect(httpSchema.properties.url).toBeDefined();
    expect(httpSchema.properties.method).toBeDefined();
    expect(httpSchema.properties.headers).toBeDefined();
    expect(httpSchema.properties.body).toBeDefined();
    expect(httpSchema.properties.timeout).toBeDefined();
    expect(httpSchema.properties.insecure).toBeDefined();
    expect(httpSchema.properties.user).toBeDefined();
    expect(httpSchema.properties.verbose).toBeDefined();
  });

  it('should execute GET request by default', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('response body'));

    const result = await executeHttp({ url: 'https://api.example.com/data' }, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(false);
    expect(mockCtx.exec).toHaveBeenCalledWith('curl', ['--max-time', '30', 'https://api.example.com/data'], expect.objectContaining({}));
  });

  it('should add method flag for non-GET', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('updated'));

    await executeHttp({ url: 'https://api.example.com/data', method: 'POST' }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('curl', expect.arrayContaining(['-X', 'POST', 'https://api.example.com/data']), expect.objectContaining({}));
  });

  it('should add headers', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({
      url: 'https://api.example.com/data',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' }
    }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith('curl', expect.arrayContaining(['-H', 'Content-Type: application/json', '-H', 'Authorization: Bearer token']), expect.objectContaining({}));
  });

  it('should write body to temp file for POST/PUT/PATCH', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({
      url: 'https://api.example.com/data',
      method: 'POST',
      body: { key: 'value' }
    }, '/cwd', undefined, mockCtx);

    // Should have called curl with --data @tempfile
    const callArgs = mockCtx.exec.mock.calls[0][1];
    const dataIndex = callArgs.indexOf('--data');
    expect(dataIndex).toBeGreaterThan(-1);
    expect(callArgs[dataIndex + 1]).toMatch(/^@\/tmp\/curl-data-/);
  });

  it('should use string body directly', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({
      url: 'https://api.example.com/data',
      method: 'POST',
      body: 'plain text'
    }, '/cwd', undefined, mockCtx);

    const callArgs = mockCtx.exec.mock.calls[0][1];
    const dataIndex = callArgs.indexOf('--data');
    expect(dataIndex).toBeGreaterThan(-1);
    expect(callArgs[dataIndex + 1]).toMatch(/^@\/tmp\/curl-data-/);
  });

  it('should add insecure flag', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({ url: 'https://self-signed.badssl.com', insecure: true }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec.mock.calls[0][1]).toContain('-k');
  });

  it('should add user auth', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({ url: 'https://api.example.com', user: 'user:pass' }, '/cwd', undefined, mockCtx);

    const callArgs = mockCtx.exec.mock.calls[0][1];
    expect(callArgs).toContain('-u');
    expect(callArgs).toContain('user:pass');
  });

  it('should add verbose flag', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({ url: 'https://api.example.com', verbose: true }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec.mock.calls[0][1]).toContain('-v');
  });

  it('should set default timeout', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({ url: 'https://api.example.com' }, '/cwd', undefined, mockCtx);

    const callArgs = mockCtx.exec.mock.calls[0][1];
    const timeoutIndex = callArgs.indexOf('--max-time');
    expect(timeoutIndex).toBeGreaterThan(-1);
    expect(callArgs[timeoutIndex + 1]).toBe('30');
  });

  it('should use custom timeout', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({ url: 'https://api.example.com', timeout: 120 }, '/cwd', undefined, mockCtx);

    const callArgs = mockCtx.exec.mock.calls[0][1];
    expect(callArgs).toContain('--max-time');
    expect(callArgs).toContain('120');
  });

  it('should handle curl errors', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult('', 'curl: (6) Could not resolve host', 6));

    const result = await executeHttp({ url: 'https://bad.host' }, '/cwd', undefined, mockCtx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('curl:');
  });

  it('should pass cwd option', async () => {
    mockCtx.exec.mockResolvedValue(mockExecResult(''));

    await executeHttp({ url: 'https://api.example.com', timeout: 30 }, '/cwd', undefined, mockCtx);

    expect(mockCtx.exec).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ cwd: '/cwd' }));
  });
});
