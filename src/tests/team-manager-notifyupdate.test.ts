import { describe, it, expect, vi } from 'vitest';
import { AgentTeam } from '../extensions/team/team-manager.js';

// Mock logger with spy methods
function createMockLogger() {
  return {
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  };
}

describe('AgentTeam notifyUpdate error handling', () => {
  it('should catch errors in onUpdate and log warning', () => {
    const mockLogger = createMockLogger();
    const team = new AgentTeam(mockLogger);
    // Assign an onUpdate that throws
    (team as any).onUpdate = () => { throw new Error('Update failed'); };
    // Call notifyUpdate
    team.notifyUpdate({ content: [{ type: 'text', text: 'test' }] });
    // Verify warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send update'), expect.any(Error));
  });
});
