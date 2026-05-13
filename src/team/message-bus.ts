/**
 * Message Bus - Async pub/sub for agent-to-agent communication
 *
 * Agents can send messages to channels and subscribe to receive messages.
 * Uses simple polling pattern (since agents are long-running LLM sessions).
 */

export interface TeamMessage {
  /** Unique message ID */
  id: string;
  /** Channel name (e.g., "team.chat", "team.help", "team.notifications") */
  channel: string;
  /** Sender agent ID */
  from: string;
  /** Message content */
  content: string;
  /** Message type */
  type: "chat" | "help_request" | "notification" | "system";
  /** Timestamp */
  timestamp: number;
  /** Optional: in-reply-to message ID */
  replyTo?: string;
}

export interface MessageSubscription {
  agentId: string;
  channel: string;
  lastSeenMessageId: string;
  callback?: (message: TeamMessage) => void;
}

/**
 * TeamMessageBus - Central message router
 *
 * All agents share one bus instance (via AgentTeam)
 */
export class TeamMessageBus {
  private messages: TeamMessage[] = [];
  private subscriptions: MessageSubscription[] = [];
  private messageIdCounter = 0;
  
  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${++this.messageIdCounter}`;
  }
  
  /**
   * Publish a message to a channel
   */
  publish(params: {
    channel: string;
    from: string;
    content: string;
    type?: TeamMessage['type'];
    replyTo?: string;
    timestamp?: number;
  }): TeamMessage {
    const message: TeamMessage = {
      id: this.generateMessageId(),
      channel: params.channel,
      from: params.from,
      content: params.content,
      type: params.type || 'chat',
      timestamp: params.timestamp || Date.now(),
      replyTo: params.replyTo,
    };
    
    this.messages.push(message);
    
    // Trigger callbacks for matching subscriptions
    this.subscriptions
      .filter(sub => sub.channel === params.channel && sub.agentId !== params.from)
      .forEach(sub => {
        if (sub.callback) {
          try {
            sub.callback(message);
          } catch (err) {
            console.error(`Error in message callback for agent ${sub.agentId}:`, err);
          }
        }
      });
    
    return message;
  }
  
  /**
   * Subscribe to a channel (async iterator pattern)
   * Returns an iterator that yields new messages
   */
  subscribe(agentId: string, channel: string, options: { since?: number; sinceMessageId?: string; callback?: (message: TeamMessage) => void } = {}): TeamMessage[] {
    // Get messages since timestamp/messageId
    let messages = this.messages;
    
    if (options.since !== undefined) {
      messages = messages.filter(m => m.timestamp > (options.since!));
    }
    
    if (options.sinceMessageId) {
      const index = this.messages.findIndex(m => m.id === options.sinceMessageId);
      if (index !== -1) {
        messages = messages.slice(index + 1);
      }
    }
    
    // Filter by channel
    messages = messages.filter(m => m.channel === channel);
    
    // Register subscription for future messages
    const subscription: MessageSubscription = {
      agentId,
      channel,
      lastSeenMessageId: messages.length > 0 ? messages[messages.length - 1].id : "",
      callback: options.callback,
    };
    this.subscriptions.push(subscription);
    
    return messages;
  }
  
  /**
   * Get all messages for a channel (polling mode)
   */
  getMessages(channel: string, options: { limit?: number; since?: number } = {}): TeamMessage[] {
    let messages = this.messages.filter(m => m.channel === channel);
    
    if (options.since !== undefined) {
      // Use >= for inclusive semantics - gets messages at or after since time
      messages = messages.filter(m => m.timestamp >= options.since!);
    }
    
    if (options.limit) {
      messages = messages.slice(0, options.limit);
    }
    
    return messages;
  }
  
  /**
   * Get unread count for a channel (for badges/indicators)
   */
  getUnreadCount(agentId: string, channel: string, lastSeenMessageId?: string): number {
    const subscription = this.subscriptions.find(s => s.agentId === agentId && s.channel === channel);
    const lastSeen = lastSeenMessageId || subscription?.lastSeenMessageId;
    
    // Get only messages for this channel
    const channelMessages = this.messages.filter(m => m.channel === channel);
    
    if (!lastSeen) {
      return channelMessages.length;
    }
    
    const index = this.messages.findIndex(m => m.id === lastSeen);
    if (index === -1) {
      return channelMessages.length;
    }
    
    // Count messages in this channel after the last seen
    const channelIndex = channelMessages.findIndex(m => m.id === lastSeen);
    if (channelIndex === -1) {
      return channelMessages.length;
    }
    
    return channelMessages.length - channelIndex - 1;
  }
  
  /**
   * Mark messages as read (update subscription pointer)
   */
  markAsRead(agentId: string, channel: string, messageId?: string): void {
    let subscription = this.subscriptions.find(s => s.agentId === agentId && s.channel === channel);
    
    // If no existing subscription, create one for tracking
    if (!subscription) {
      subscription = {
        agentId,
        channel,
        lastSeenMessageId: "",
      };
      this.subscriptions.push(subscription);
    }
    
    subscription.lastSeenMessageId = messageId || 
      (this.messages.filter(m => m.channel === channel).length > 0 
        ? this.messages[this.messages.length - 1].id 
        : "");
  }
  
  /**
   * Clear messages older than TTL (memory management)
   */
  pruneOldMessages(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.messages = this.messages.filter(m => m.timestamp > cutoff);
  }
  
  /**
   * Clear all messages (testing only)
   */
  clear(): void {
    this.messages = [];
    this.subscriptions = [];
    this.messageIdCounter = 0;
  }
  
  /**
   * Get message by ID
   */
  getMessage(messageId: string): TeamMessage | undefined {
    return this.messages.find(m => m.id === messageId);
  }
  
  /**
   * Send direct message (private channel)
   */
  sendDirectMessage(from: string, to: string, content: string): TeamMessage {
    return this.publish({
      channel: `direct.${to}`,
      from,
      content,
      type: "chat",
    });
  }
  
  /**
   * Get direct messages for an agent
   */
  getDirectMessages(agentId: string, options: { limit?: number; since?: number } = {}): TeamMessage[] {
    return this.getMessages(`direct.${agentId}`, options);
  }
  
  /**
   * Broadcast to all agents (except sender)
   */
  broadcast(from: string, content: string, type: TeamMessage["type"] = "notification"): TeamMessage {
    return this.publish({
      channel: "team.broadcast",
      from,
      content,
      type,
    });
  }
}

/**
 * Convenience channel names
 */
export const CHANNELS = {
  TEAM_CHAT: "team.chat",
  TEAM_HELP: "team.help",
  TEAM_NOTIFICATIONS: "team.notifications",
  TEAM_SYSTEM: "team.system",
  
  // Helper to get direct message channel
  direct(agentId: string): string {
    return `direct.${agentId}`;
  }
} as const;
