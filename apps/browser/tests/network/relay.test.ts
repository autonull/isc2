/**
 * Create tests for NAT traversal and model migration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NATTraversalManager,
  createNATTraversalManager,
  calculateConnectionQuality,
  type RelayCandidate,
  type ConnectionQuality,
} from '../../src/network/relay';

describe('NATTraversalManager', () => {
  let manager: NATTraversalManager;

  beforeEach(() => {
    manager = createNATTraversalManager();
  });

  describe('addRelay', () => {
    it('should add relay to pool', () => {
      const relay: RelayCandidate = {
        peerID: 'relay_1',
        multiaddr: '/ip4/192.168.1.1/tcp/8080',
        type: 'circuit',
        latency: 50,
        successRate: 0.95,
        usageCount: 0,
        qualityScore: 0.8,
      };

      manager.addRelay(relay);
      const best = manager.getBestRelay();

      expect(best?.peerID).toBe('relay_1');
    });

    it('should respect max pool size', () => {
      const smallManager = createNATTraversalManager({ maxRelayPoolSize: 3 });

      for (let i = 0; i < 5; i++) {
        smallManager.addRelay({
          peerID: `relay_${i}`,
          multiaddr: `/ip4/192.168.1.${i}/tcp/8080`,
          type: 'circuit',
          latency: 50 + i * 10,
          successRate: 0.95 - i * 0.05,
          usageCount: i,
          qualityScore: 0.9 - i * 0.1,
        });
      }

      const stats = smallManager.getRelayPoolStats();
      expect(stats.totalRelays).toBeLessThanOrEqual(3);
    });

    it('should replace low quality relay when pool is full', () => {
      const smallManager = createNATTraversalManager({ maxRelayPoolSize: 2 });

      smallManager.addRelay({
        peerID: 'relay_low',
        multiaddr: '/ip4/192.168.1.1/tcp/8080',
        type: 'circuit',
        latency: 200,
        successRate: 0.5,
        usageCount: 0,
        qualityScore: 0.3,
      });

      smallManager.addRelay({
        peerID: 'relay_high',
        multiaddr: '/ip4/192.168.1.2/tcp/8080',
        type: 'circuit',
        latency: 50,
        successRate: 0.95,
        usageCount: 10,
        qualityScore: 0.9,
      });

      const best = smallManager.getBestRelay();
      expect(best?.peerID).toBe('relay_high');
    });
  });

  describe('updateRelayStats', () => {
    it('should update success rate on success', () => {
      manager.addRelay({
        peerID: 'relay_1',
        multiaddr: '/ip4/192.168.1.1/tcp/8080',
        type: 'circuit',
        latency: 50,
        successRate: 0.8,
        usageCount: 10,
        qualityScore: 0.7,
      });

      manager.updateRelayStats('relay_1', true);

      const best = manager.getBestRelay();
      expect(best?.successRate).toBeGreaterThan(0.8);
    });

    it('should update success rate on failure', () => {
      manager.addRelay({
        peerID: 'relay_1',
        multiaddr: '/ip4/192.168.1.1/tcp/8080',
        type: 'circuit',
        latency: 50,
        successRate: 0.8,
        usageCount: 10,
        qualityScore: 0.7,
      });

      manager.updateRelayStats('relay_1', false);

      const best = manager.getBestRelay();
      expect(best?.successRate).toBeLessThan(0.8);
    });

    it('should update latency with EMA', () => {
      manager.addRelay({
        peerID: 'relay_1',
        multiaddr: '/ip4/192.168.1.1/tcp/8080',
        type: 'circuit',
        latency: 100,
        successRate: 0.9,
        usageCount: 10,
        qualityScore: 0.7,
      });

      manager.updateRelayStats('relay_1', true, 50);

      const best = manager.getBestRelay();
      expect(best?.latency).toBeLessThan(100);
      expect(best?.latency).toBeGreaterThan(50);
    });
  });

  describe('getTopRelays', () => {
    it('should return top N relays by quality', () => {
      manager.addRelay({
        peerID: 'relay_1',
        multiaddr: '/ip4/192.168.1.1/tcp/8080',
        type: 'circuit',
        latency: 100,
        successRate: 0.7,
        usageCount: 5,
        qualityScore: 0.6,
      });
      manager.addRelay({
        peerID: 'relay_2',
        multiaddr: '/ip4/192.168.1.2/tcp/8080',
        type: 'circuit',
        latency: 50,
        successRate: 0.95,
        usageCount: 20,
        qualityScore: 0.9,
      });
      manager.addRelay({
        peerID: 'relay_3',
        multiaddr: '/ip4/192.168.1.3/tcp/8080',
        type: 'turn',
        latency: 75,
        successRate: 0.85,
        usageCount: 15,
        qualityScore: 0.75,
      });

      const top2 = manager.getTopRelays(2);
      expect(top2.length).toBe(2);
      expect(top2[0].peerID).toBe('relay_2');
      expect(top2[1].peerID).toBe('relay_3');
    });
  });

  describe('recordConnectionQuality', () => {
    it('should record quality for peer', () => {
      const quality: ConnectionQuality = {
        peerID: 'peer_1',
        score: 0.85,
        latency: 50,
        packetLoss: 0.01,
        jitter: 10,
        bandwidth: 1000,
        stability: 0.9,
        lastUpdated: Date.now(),
      };

      manager.recordConnectionQuality(quality);
      const retrieved = manager.getConnectionQuality('peer_1');

      expect(retrieved?.score).toBeCloseTo(0.85, 2);
    });

    it('should update existing quality with EMA', () => {
      const quality1: ConnectionQuality = {
        peerID: 'peer_1',
        score: 0.9,
        latency: 50,
        packetLoss: 0.01,
        jitter: 10,
        bandwidth: 1000,
        stability: 0.9,
        lastUpdated: Date.now(),
      };

      manager.recordConnectionQuality(quality1);

      const quality2: ConnectionQuality = {
        peerID: 'peer_1',
        score: 0.7,
        latency: 100,
        packetLoss: 0.05,
        jitter: 20,
        bandwidth: 500,
        stability: 0.7,
        lastUpdated: Date.now(),
      };

      manager.recordConnectionQuality(quality2);
      const retrieved = manager.getConnectionQuality('peer_1');

      expect(retrieved?.score).toBeLessThan(0.9);
      expect(retrieved?.score).toBeGreaterThan(0.7);
    });
  });

  describe('isConnectionAcceptable', () => {
    it('should return true for good quality', () => {
      manager.recordConnectionQuality({
        peerID: 'peer_1',
        score: 0.8,
        latency: 50,
        packetLoss: 0.01,
        jitter: 10,
        bandwidth: 1000,
        stability: 0.9,
        lastUpdated: Date.now(),
      });

      expect(manager.isConnectionAcceptable('peer_1')).toBe(true);
    });

    it('should return false for poor quality', () => {
      manager.recordConnectionQuality({
        peerID: 'peer_1',
        score: 0.2,
        latency: 500,
        packetLoss: 0.2,
        jitter: 100,
        bandwidth: 100,
        stability: 0.3,
        lastUpdated: Date.now(),
      });

      expect(manager.isConnectionAcceptable('peer_1')).toBe(false);
    });

    it('should return true for unknown peer', () => {
      expect(manager.isConnectionAcceptable('unknown_peer')).toBe(true);
    });
  });

  describe('getICEServers', () => {
    it('should return configured STUN and TURN servers', () => {
      const managerWithTurn = createNATTraversalManager({
        turnServers: [
          {
            urls: ['turn:turn.example.com:3478'],
            username: 'user',
            credential: 'pass',
          },
        ],
      });

      const servers = managerWithTurn.getICEServers();
      expect(servers.length).toBeGreaterThan(0);
      expect(servers.some((s) => s.urls[0].includes('stun'))).toBe(true);
      expect(servers.some((s) => s.urls[0].includes('turn'))).toBe(true);
    });
  });

  describe('getRelayPoolStats', () => {
    it('should return accurate statistics', () => {
      manager.addRelay({
        peerID: 'relay_1',
        multiaddr: '/ip4/192.168.1.1/tcp/8080',
        type: 'circuit',
        latency: 50,
        successRate: 0.9,
        usageCount: 10,
        qualityScore: 0.8,
      });
      manager.addRelay({
        peerID: 'relay_2',
        multiaddr: '/ip4/192.168.1.2/tcp/8080',
        type: 'turn',
        latency: 75,
        successRate: 0.85,
        usageCount: 5,
        qualityScore: 0.7,
      });

      const stats = manager.getRelayPoolStats();
      expect(stats.totalRelays).toBe(2);
      expect(stats.circuitRelays).toBe(1);
      expect(stats.turnRelays).toBe(1);
      expect(stats.avgQualityScore).toBeGreaterThan(0);
    });
  });

  describe('start/stop', () => {
    it('should start and stop refresh timer', () => {
      manager.start();
      // Timer should be running
      manager.stop();
      // Timer should be stopped
    });
  });
});

describe('calculateConnectionQuality', () => {
  it('should calculate quality from metrics', () => {
    const quality = calculateConnectionQuality(50, 0.01, 10, 1000);
    expect(quality).toBeGreaterThan(0.7);
  });

  it('should return low quality for poor metrics', () => {
    const quality = calculateConnectionQuality(500, 0.2, 100, 100);
    expect(quality).toBeLessThan(0.5);
  });

  it('should weight latency heavily', () => {
    const good = calculateConnectionQuality(50, 0.01, 10, 1000);
    const bad = calculateConnectionQuality(400, 0.01, 10, 1000);
    expect(good).toBeGreaterThan(bad);
  });
});

describe('NATTraversalManager - Edge Cases', () => {
  it('should handle empty relay pool', () => {
    const manager = createNATTraversalManager();
    const best = manager.getBestRelay();
    expect(best).toBeUndefined();
  });

  it('should handle many relays', () => {
    const manager = createNATTraversalManager({ maxRelayPoolSize: 100 });

    for (let i = 0; i < 50; i++) {
      manager.addRelay({
        peerID: `relay_${i}`,
        multiaddr: `/ip4/192.168.1.${i % 256}/tcp/8080`,
        type: i % 3 === 0 ? 'turn' : 'circuit',
        latency: 50 + Math.random() * 100,
        successRate: 0.8 + Math.random() * 0.2,
        usageCount: Math.floor(Math.random() * 100),
        qualityScore: 0.5 + Math.random() * 0.5,
      });
    }

    const stats = manager.getRelayPoolStats();
    expect(stats.totalRelays).toBe(50);
    expect(stats.avgQualityScore).toBeGreaterThan(0);
  });

  it('should load balance across relays', () => {
    const manager = createNATTraversalManager();

    // Add relays with same quality
    for (let i = 0; i < 3; i++) {
      manager.addRelay({
        peerID: `relay_${i}`,
        multiaddr: `/ip4/192.168.1.${i}/tcp/8080`,
        type: 'circuit',
        latency: 50,
        successRate: 0.9,
        usageCount: 0,
        qualityScore: 0.85,
      });
    }

    // Get best relay multiple times
    const relays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const best = manager.getBestRelay();
      if (best) {
        relays.push(best.peerID);
        manager.updateRelayStats(best.peerID, true, 50);
      }
    }

    // Should cycle through relays
    const uniqueRelays = new Set(relays);
    expect(uniqueRelays.size).toBeGreaterThan(1);
  });
});
