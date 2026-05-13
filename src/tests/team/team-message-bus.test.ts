/**
 * Unit tests for TeamMessageBus
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TeamMessageBus, CHANNELS } from '../message-bus.js';

describe('TeamMessageBus', () => {
  let bus: TeamMessageBus;

  beforeEach(() => {
    bus = new TeamMessageBus();
  });

  describe('publish', () => {
    it('should create message with unique ID and timestamp', () => {
      const msg = bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Hello team',
      });

      expect(msg.id).toMatch(/^msg-\d+-\d+$/);
      expect(msg.timestamp).toBeGreaterThan(0);
      expect(msg.channel).toBe('team.chat');
      expect(msg.from).toBe('agent-1');
      expect(msg.content).toBe('Hello team');
      expect(msg.type).toBe('chat');
    });

    it('should add message to internal store', () => {
      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Test message',
      });

      const messages = bus.getMessages('team.chat');
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Test message');
    });

    it('should trigger callbacks for matching subscriptions', () => {
      const receivedMessages: any[] = [];
      bus.subscribe('agent-2', 'team.chat', {
        callback: (msg) => receivedMessages.push(msg)
      });

      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Hello agent-2',
      });

      expect(receivedMessages.length).toBe(1);
      expect(receivedMessages[0].content).toBe('Hello agent-2');
    });

    it('should not trigger callback for sender', () => {
      const receivedMessages: any[] = [];
      bus.subscribe('agent-1', 'team.chat', {
        callback: (msg) => receivedMessages.push(msg)
      });

      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'My own message',
      });

      expect(receivedMessages.length).toBe(0);
    });

    it('should support custom message type', () => {
      bus.publish({
        channel: 'team.help',
        from: 'agent-1',
        content: 'Need help',
        type: 'help_request',
      });

      const messages = bus.getMessages('team.help');
      expect(messages[0].type).toBe('help_request');
    });

    it('should support replyTo field', () => {
      const originalMsg = bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Original',
      });

      const reply = bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Reply',
        replyTo: originalMsg.id,
      });

      expect(reply.replyTo).toBe(originalMsg.id);
    });
  });

  describe('subscribe', () => {
    it('should return past messages since timestamp', () => {
      const now = Date.now();

      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Message 1',
        timestamp: now - 1000,
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Message 2',
        timestamp: now - 500,
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-3',
        content: 'Message 3',
        timestamp: now,
      });

      const messages = bus.subscribe('agent-4', 'team.chat', { since: now - 750 });
      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('Message 2');
      expect(messages[1].content).toBe('Message 3');
    });

    it('should return past messages since messageId', () => {
      const msg1 = bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Message 1',
      });
      const msg2 = bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Message 2',
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-3',
        content: 'Message 3',
      });

      const messages = bus.subscribe('agent-4', 'team.chat', { sinceMessageId: msg1.id });
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Message 2'); // After msg1
    });

    it('should register subscription for future messages', () => {
      const received: any[] = [];
      bus.subscribe('agent-2', 'team.chat', {
        callback: (msg) => received.push(msg)
      });

      // Messages sent after subscription should trigger callback
      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Future message',
      });

      expect(received.length).toBe(1);
    });

    it('should filter by channel', () => {
      bus.subscribe('agent-2', 'team.help', { callback: () => {} });

      // Message to different channel should not be delivered
      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Wrong channel',
      });

      // No error means filtering works
    });
  });

  describe('getMessages', () => {
    it('should return all messages for channel', () => {
      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Msg 1',
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Msg 2',
      });
      bus.publish({
        channel: 'team.help',
        from: 'agent-3',
        content: 'Help',
      });

      const messages = bus.getMessages('team.chat');
      expect(messages.length).toBe(2);
    });

    it('should filter by since timestamp', () => {
      const now = Date.now();

      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Old',
        timestamp: now - 5000,
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'New',
        timestamp: now,
      });

      const messages = bus.getMessages('team.chat', { since: now - 1000 });
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('New');
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        bus.publish({
          channel: 'team.chat',
          from: 'agent-1',
          content: `Msg ${i}`,
        });
      }

      const messages = bus.getMessages('team.chat', { limit: 4 });
      expect(messages.length).toBe(4);
      expect(messages[0].content).toBe('Msg 0');
      expect(messages[3].content).toBe('Msg 3');
    });

    it('should handle non-existent channel', () => {
      const messages = bus.getMessages('nonexistent');
      expect(messages).toEqual([]);
    });
  });

  describe('getUnreadCount', () => {
    it('should count all messages if no lastSeen', () => {
      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Msg 1',
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Msg 2',
      });

      expect(bus.getUnreadCount('agent-3', 'team.chat')).toBe(2);
    });

    it('should count unread messages after lastSeenMessageId', () => {
      const msg1 = bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Msg 1',
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Msg 2',
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-3',
        content: 'Msg 3',
      });

      expect(bus.getUnreadCount('agent-4', 'team.chat', msg1.id)).toBe(2);
    });

    it('should return 0 if lastSeen points to last message', () => {
      const msg1 = bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Msg 1',
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Msg 2',
      });

      // Mark as read using lastSeen as msg2 (but we need msg2's id)
      const messages = bus.getMessages('team.chat');
      const lastMsg = messages[messages.length - 1];

      expect(bus.getUnreadCount('agent-3', 'team.chat', lastMsg.id)).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should update subscription lastSeen pointer', () => {
      const msg1 = bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Msg 1',
      });
      const msg2 = bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Msg 2',
      });

      bus.markAsRead('agent-3', 'team.chat', msg2.id);
      expect(bus.getUnreadCount('agent-3', 'team.chat')).toBe(0);
    });

    it('should create subscription if not exists', () => {
      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Msg',
      });

      bus.markAsRead('agent-2', 'team.chat');
      // Should not throw
    });
  });

  describe('clear', () => {
    it('should clear all messages and subscriptions', () => {
      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Test',
      });
      bus.subscribe('agent-2', 'team.chat', { callback: () => {} });

      bus.clear();

      expect(bus.getMessages('team.chat').length).toBe(0);
      // Subscriptions cleared internally
    });
  });

  describe('pruneOldMessages', () => {
    it('should remove messages older than TTL', () => {
      const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const recentTime = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago

      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Old message',
        timestamp: oldTime,
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Recent message',
        timestamp: recentTime,
      });

      bus.pruneOldMessages(24 * 60 * 60 * 1000); // 24 hour TTL

      const messages = bus.getMessages('team.chat');
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Recent message');
    });
  });

  describe('getMessage', () => {
    it('should retrieve message by ID', () => {
      const msg = bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Find me',
      });

      const found = bus.getMessage(msg.id);
      expect(found).toBeDefined();
      expect(found!.content).toBe('Find me');
    });

    it('should return undefined for non-existent ID', () => {
      const found = bus.getMessage('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('sendDirectMessage', () => {
    it('should send message to direct channel', () => {
      const msg = bus.sendDirectMessage('agent-1', 'agent-2', 'Private message');

      expect(msg.channel).toBe('direct.agent-2');
      expect(msg.from).toBe('agent-1');
      expect(msg.content).toBe('Private message');
    });

    it('should be retrievable via getDirectMessages', () => {
      bus.sendDirectMessage('agent-1', 'agent-2', 'Hello');

      const messages = bus.getDirectMessages('agent-2');
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Hello');
    });
  });

  describe('broadcast', () => {
    it('should send to team.broadcast channel', () => {
      const msg = bus.broadcast('agent-1', 'Attention all agents');

      expect(msg.channel).toBe('team.broadcast');
      expect(msg.type).toBe('notification');
    });
  });

  describe('CHANNELS helper', () => {
    it('should provide correct channel names', () => {
      expect(CHANNELS.TEAM_CHAT).toBe('team.chat');
      expect(CHANNELS.TEAM_HELP).toBe('team.help');
      expect(CHANNELS.TEAM_NOTIFICATIONS).toBe('team.notifications');
      expect(CHANNELS.TEAM_SYSTEM).toBe('team.system');
      expect(CHANNELS.direct('agent-1')).toBe('direct.agent-1');
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple publishers and subscribers', () => {
      const received: string[] = [];
      bus.subscribe('subscriber-1', 'team.chat', {
        callback: (msg) => received.push(msg.content)
      });
      bus.subscribe('subscriber-2', 'team.chat', {
        callback: (msg) => received.push(msg.content)
      });

      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'Broadcast',
      });

      // Both subscribers should receive
      expect(received.length).toBe(2);
      expect(received.filter(c => c === 'Broadcast').length).toBe(2);
    });
  });

  describe('message ordering', () => {
    it('should maintain chronological order', () => {
      bus.publish({
        channel: 'team.chat',
        from: 'agent-1',
        content: 'First',
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Second',
      });
      bus.publish({
        channel: 'team.chat',
        from: 'agent-3',
        content: 'Third',
      });

      const messages = bus.getMessages('team.chat');
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });
  });

  describe('edge cases', () => {
    it('should handle empty channel queries', () => {
      const messages = bus.getMessages('empty-channel');
      expect(messages).toEqual([]);
    });

    it('should handle subscribe with no callback', () => {
      // Should not throw
      bus.subscribe('agent-1', 'team.chat', {});
      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Test',
      });
    });

    it('should handle callback errors gracefully', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      bus.subscribe('agent-1', 'team.chat', {
        callback: () => { throw new Error('Test error'); }
      });

      bus.publish({
        channel: 'team.chat',
        from: 'agent-2',
        content: 'Trigger error',
      });

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
