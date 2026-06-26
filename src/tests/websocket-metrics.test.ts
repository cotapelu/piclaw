import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocketMetrics, WebSocketServerMetrics } from '../websocket-tui-server.js';

describe('WebSocketMetrics', () => {
  let metrics: WebSocketMetrics;

  beforeEach(() => {
    metrics = new WebSocketMetrics();
  });

  describe('initial state', () => {
    it('should have zero counts', () => {
      const snapshot = metrics.getSnapshot();
      expect(snapshot.activeConnections).toBe(0);
      expect(snapshot.totalConnections).toBe(0);
      expect(snapshot.totalErrors).toBe(0);
      expect(snapshot.totalPtySpawned).toBe(0);
    });

    it('should have a startTime in the recent past', () => {
      const snapshot = metrics.getSnapshot();
      const age = Date.now() - snapshot.startTime.getTime();
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(1000); // within 1 second
    });

    it('should have uptimeSeconds near zero', () => {
      const snapshot = metrics.getSnapshot();
      expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(snapshot.uptimeSeconds).toBeLessThan(1);
    });
  });

  describe('connection tracking', () => {
    it('should increment active and total on incConnection', () => {
      metrics.incConnection();
      let snapshot = metrics.getSnapshot();
      expect(snapshot.activeConnections).toBe(1);
      expect(snapshot.totalConnections).toBe(1);

      metrics.incConnection();
      snapshot = metrics.getSnapshot();
      expect(snapshot.activeConnections).toBe(2);
      expect(snapshot.totalConnections).toBe(2);
    });

    it('should decrement active but not total on decConnection', () => {
      metrics.incConnection();
      metrics.incConnection();
      metrics.decConnection();
      let snapshot = metrics.getSnapshot();
      expect(snapshot.activeConnections).toBe(1);
      expect(snapshot.totalConnections).toBe(2);

      metrics.decConnection();
      snapshot = metrics.getSnapshot();
      expect(snapshot.activeConnections).toBe(0);
      expect(snapshot.totalConnections).toBe(2);
    });

    it('should not decrement active below zero', () => {
      metrics.decConnection();
      let snapshot = metrics.getSnapshot();
      expect(snapshot.activeConnections).toBe(0);

      metrics.decConnection();
      snapshot = metrics.getSnapshot();
      expect(snapshot.activeConnections).toBe(0);
    });
  });

  describe('error tracking', () => {
    it('should increment totalErrors on incError', () => {
      metrics.incError();
      metrics.incError();
      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalErrors).toBe(2);
    });
  });

  describe('PTY tracking', () => {
    it('should increment totalPtySpawned on incPtySpawned', () => {
      metrics.incPtySpawned();
      metrics.incPtySpawned();
      metrics.incPtySpawned();
      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalPtySpawned).toBe(3);
    });
  });

  describe('snapshot isolation', () => {
    it('should return an independent snapshot that does not change', () => {
      metrics.incConnection();
      const snapshot1 = metrics.getSnapshot();
      expect(snapshot1.activeConnections).toBe(1);

      metrics.incConnection();
      const snapshot2 = metrics.getSnapshot();
      expect(snapshot2.activeConnections).toBe(2);

      // snapshot1 remains unchanged
      expect(snapshot1.activeConnections).toBe(1);
    });
  });
});
