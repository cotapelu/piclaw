import { describe, it, expect, beforeEach } from "vitest";
import { TeamMessageBus, CHANNELS } from "../../team/message-bus.js";

describe("TeamMessageBus", () => {
  let bus: TeamMessageBus;
  
  beforeEach(() => {
    bus = new TeamMessageBus();
  });
  
  describe("publish and subscribe", () => {
    it("should publish message to channel", () => {
      const msg = bus.publish({
        channel: "team.chat",
        from: "agent-1",
        content: "Hello team!"
      });
      
      expect(msg.id).toMatch(/^msg-\d+-\d+$/);
      expect(msg.channel).toBe("team.chat");
      expect(msg.from).toBe("agent-1");
      expect(msg.content).toBe("Hello team!");
      expect(msg.type).toBe("chat");
      expect(msg.timestamp).toBeGreaterThan(0);
    });
    
    it("should subscribe and receive messages", () => {
      const messages: any[] = [];
      bus.subscribe("agent-2", "team.chat", {
        callback: (msg) => messages.push(msg)
      });
      
      bus.publish({
        channel: "team.chat",
        from: "agent-1",
        content: "Test message"
      });
      
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Test message");
      expect(messages[0].from).toBe("agent-1");
    });
    
    it("should not deliver sender's own message to themselves", () => {
      const messages: any[] = [];
      bus.subscribe("agent-1", "team.chat", {
        callback: (msg) => messages.push(msg)
      });
      
      bus.publish({
        channel: "team.chat",
        from: "agent-1",
        content: "My message"
      });
      
      expect(messages).toHaveLength(0);
    });
    
    it("should deliver messages from different senders", () => {
      const agent2Messages: any[] = [];
      const agent3Messages: any[] = [];
      
      bus.subscribe("agent-2", "team.chat", { callback: (msg) => agent2Messages.push(msg) });
      bus.subscribe("agent-3", "team.chat", { callback: (msg) => agent3Messages.push(msg) });
      
      bus.publish({ channel: "team.chat", from: "agent-1", content: "Hi all" });
      bus.publish({ channel: "team.chat", from: "agent-1", content: "Again" });
      
      expect(agent2Messages).toHaveLength(2);
      expect(agent3Messages).toHaveLength(2);
    });
  });
  
  describe("getMessages", () => {
    it("should retrieve messages from channel", () => {
      bus.publish({ channel: "team.help", from: "agent-1", content: "Need help" });
      bus.publish({ channel: "team.help", from: "agent-2", content: "I can help" });
      bus.publish({ channel: "team.chat", from: "agent-1", content: "Off-topic" });
      
      const helpMsgs = bus.getMessages("team.help");
      expect(helpMsgs).toHaveLength(2);
      expect(helpMsgs[0].content).toBe("Need help");
      expect(helpMsgs[1].content).toBe("I can help");
    });
    
    it("should filter by limit", () => {
      for (let i = 0; i < 10; i++) {
        bus.publish({ channel: "team.chat", from: "agent-1", content: `Msg ${i}` });
      }
      
      const recent = bus.getMessages("team.chat", { limit: 5 });
      expect(recent).toHaveLength(5);
      expect(recent[0].content).toBe("Msg 0"); // FIFO order preserved
    });
    
    it("should filter by since timestamp", () => {
      const t1 = Date.now();
      bus.publish({ channel: "team.chat", from: "agent-1", content: "Old" });
      const t2 = Date.now();
      bus.publish({ channel: "team.chat", from: "agent-1", content: "New" });
      
      const messages = bus.getMessages("team.chat", { since: t1 });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("New");
    });
  });
  
  describe("direct messages", () => {
    it("should send direct message to specific agent", () => {
      const directMsgs: any[] = [];
      bus.subscribe("agent-2", CHANNELS.direct("agent-2"), {
        callback: (msg) => directMsgs.push(msg)
      });
      
      bus.sendDirectMessage("agent-1", "agent-2", "Private message");
      
      expect(directMsgs).toHaveLength(1);
      expect(directMsgs[0].channel).toBe("direct.agent-2");
      expect(directMsgs[0].content).toBe("Private message");
      expect(directMsgs[0].from).toBe("agent-1");
    });
    
    it("should get direct messages for agent", () => {
      bus.sendDirectMessage("agent-1", "agent-2", "Message 1");
      bus.sendDirectMessage("agent-3", "agent-2", "Message 2");
      
      const msgs = bus.getDirectMessages("agent-2");
      expect(msgs).toHaveLength(2);
    });
  });
  
  describe("broadcast", () => {
    it("should broadcast to all agents except sender", () => {
      const agent2Msgs: any[] = [];
      const agent3Msgs: any[] = [];
      
      bus.subscribe("agent-2", "team.broadcast", { callback: (msg) => agent2Msgs.push(msg) });
      bus.subscribe("agent-3", "team.broadcast", { callback: (msg) => agent3Msgs.push(msg) });
      
      bus.broadcast("agent-1", "Important announcement");
      
      expect(agent2Msgs).toHaveLength(1);
      expect(agent3Msgs).toHaveLength(1);
      expect(agent2Msgs[0].content).toBe("Important announcement");
      expect(agent2Msgs[0].from).toBe("agent-1");
      expect(agent2Msgs[0].channel).toBe("team.broadcast");
    });
  });
  
  describe("unread count", () => {
    it("should count unread messages", () => {
      bus.publish({ channel: "team.chat", from: "agent-1", content: "Msg 1" });
      bus.publish({ channel: "team.chat", from: "agent-2", content: "Msg 2" });
      
      const count = bus.getUnreadCount("agent-3", "team.chat");
      expect(count).toBe(2);
      
      // Mark as read
      bus.markAsRead("agent-3", "team.chat");
      expect(bus.getUnreadCount("agent-3", "team.chat")).toBe(0);
    });
    
    it("should count unread since specific message", () => {
      const msg1 = bus.publish({ channel: "team.chat", from: "agent-1", content: "Msg 1" });
      bus.publish({ channel: "team.chat", from: "agent-2", content: "Msg 2" });
      bus.publish({ channel: "team.chat", from: "agent-3", content: "Msg 3" });
      
      const count = bus.getUnreadCount("agent-4", "team.chat", msg1.id);
      expect(count).toBe(2); // Msg 2 and Msg 3
    });
  });
  
  describe("message retrieval", () => {
    it("should get message by ID", () => {
      const msg = bus.publish({ channel: "team.chat", from: "agent-1", content: "Find me" });
      const found = bus.getMessage(msg.id);
      expect(found).toBe(msg);
    });
    
    it("should return undefined for non-existent ID", () => {
      const found = bus.getMessage("non-existent");
      expect(found).toBeUndefined();
    });
  });
  
  describe("cleanup", () => {
    it("should clear all messages", () => {
      bus.publish({ channel: "team.chat", from: "agent-1", content: "1" });
      bus.publish({ channel: "team.chat", from: "agent-2", content: "2" });
      
      bus.clear();
      
      expect(bus.getMessages("team.chat")).toHaveLength(0);
      expect(bus.getUnreadCount("agent-3", "team.chat")).toBe(0);
    });
    
    it("should prune old messages", () => {
      // Manually set timestamp on messages (hard to test due to Date.now())
      // Just verify method exists and runs without error
      bus.clear(); // Ensure empty
      bus.publish({ channel: "team.chat", from: "agent-1", content: "Test" });
      bus.pruneOldMessages(0); // Prune everything
      expect(bus.getMessages("team.chat")).toHaveLength(0);
    });
  });
});
