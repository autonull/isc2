/**
 * Unit Tests for Hierarchical DHT
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HierarchicalDHT } from '../src/dht/hierarchical.js';
import { GeoShard, calculateDistance, generateShardID } from '../src/dht/sharding.js';
import { CrossShardRouter } from '../src/dht/routing.js';

describe('Hierarchical DHT', () => {
  describe('GeoShard', () => {
    let shard: GeoShard;

    beforeEach(() => {
      shard = new GeoShard({
        level: 'local',
        shardID: 'test_shard',
        maxPeers: 100,
        replicationFactor: 1,
      });
    });

    describe('addPeer', () => {
      it('should add peer to shard', () => {
        const entry = {
          peerID: 'peer1',
          shardID: 'test_shard',
          lastSeen: Date.now(),
          latency: 50,
          capabilities: ['chat'],
        };

        const success = shard.addPeer(entry);
        expect(success).toBe(true);
        expect(shard.getPeerCount()).toBe(1);
      });

      it('should reject peer when shard is full', () => {
        const smallShard = new GeoShard({
          level: 'local',
          shardID: 'small',
          maxPeers: 2,
          replicationFactor: 1,
        });

        smallShard.addPeer({ peerID: 'p1', shardID: 'small', lastSeen: Date.now(), latency: 10, capabilities: [] });
        smallShard.addPeer({ peerID: 'p2', shardID: 'small', lastSeen: Date.now(), latency: 10, capabilities: [] });

        const success = smallShard.addPeer({ peerID: 'p3', shardID: 'small', lastSeen: Date.now(), latency: 10, capabilities: [] });
        expect(success).toBe(false);
      });
    });

    describe('storeData/retrieveData', () => {
      it('should store and retrieve data', () => {
        shard.storeData('key1', 'value1');
        const value = shard.retrieveData('key1');
        expect(value).toBe('value1');
      });

      it('should return undefined for missing key', () => {
        const value = shard.retrieveData('nonexistent');
        expect(value).toBeUndefined();
      });

      it('should expire data after TTL', () => {
        shard.storeData('key1', 'value1', 0.001);  // 1ms TTL
        
        // Wait for expiration
        return new Promise(resolve => {
          setTimeout(() => {
            const value = shard.retrieveData('key1');
            expect(value).toBeUndefined();
            resolve(true);
          }, 10);
        });
      });
    });

    describe('getHealthScore', () => {
      it('should return high health for active peers', () => {
        shard.addPeer({ peerID: 'p1', shardID: 'test', lastSeen: Date.now(), latency: 10, capabilities: [] });
        shard.addPeer({ peerID: 'p2', shardID: 'test', lastSeen: Date.now(), latency: 10, capabilities: [] });

        const health = shard.getHealthScore();
        expect(health).toBeGreaterThan(0.8);
      });

      it('should return low health for inactive peers', () => {
        shard.addPeer({ peerID: 'p1', shardID: 'test', lastSeen: Date.now() - 120000, latency: 10, capabilities: [] });

        const health = shard.getHealthScore();
        expect(health).toBeLessThan(0.5);
      });
    });

    describe('needsSplit', () => {
      it('should return true when at capacity', () => {
        const smallShard = new GeoShard({
          level: 'local',
          shardID: 'small',
          maxPeers: 2,
          replicationFactor: 1,
        });

        smallShard.addPeer({ peerID: 'p1', shardID: 'small', lastSeen: Date.now(), latency: 10, capabilities: [] });
        smallShard.addPeer({ peerID: 'p2', shardID: 'small', lastSeen: Date.now(), latency: 10, capabilities: [] });

        expect(smallShard.needsSplit()).toBe(true);
      });

      it('should return false when under capacity', () => {
        shard.addPeer({ peerID: 'p1', shardID: 'test', lastSeen: Date.now(), latency: 10, capabilities: [] });
        expect(shard.needsSplit()).toBe(false);
      });
    });

    describe('split', () => {
      it('should split shard into two', () => {
        shard.addPeer({ peerID: 'p1', shardID: 'test', lastSeen: Date.now(), latency: 10, capabilities: [] });
        shard.addPeer({ peerID: 'p2', shardID: 'test', lastSeen: Date.now(), latency: 10, capabilities: [] });
        shard.addPeer({ peerID: 'p3', shardID: 'test', lastSeen: Date.now(), latency: 10, capabilities: [] });

        const { shard1, shard2 } = shard.split();

        expect(shard1.getInfo().shardID).toContain('_a');
        expect(shard2.getInfo().shardID).toContain('_b');
        expect(shard1.getPeerCount() + shard2.getPeerCount()).toBe(3);
      });
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const loc1 = { latitude: 0, longitude: 0 };
      const loc2 = { latitude: 0, longitude: 90 };  // Quarter of Earth's circumference

      const distance = calculateDistance(loc1, loc2);
      expect(distance).toBeGreaterThan(9000);  // ~10,000 km
      expect(distance).toBeLessThan(11000);
    });

    it('should return 0 for same location', () => {
      const loc = { latitude: 35.6895, longitude: 139.6917 };
      const distance = calculateDistance(loc, loc);
      expect(distance).toBeLessThan(0.01);
    });
  });

  describe('generateShardID', () => {
    it('should generate consistent shard ID', () => {
      const loc = { latitude: 35.6895, longitude: 139.6917 };
      const id1 = generateShardID('local', loc);
      const id2 = generateShardID('local', loc);
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different locations', () => {
      const loc1 = { latitude: 35.6895, longitude: 139.6917 };  // Tokyo
      const loc2 = { latitude: 40.7128, longitude: -74.0060 };  // New York

      const id1 = generateShardID('local', loc1);
      const id2 = generateShardID('local', loc2);
      expect(id1).not.toBe(id2);
    });

    it('should include level in shard ID', () => {
      const loc = { latitude: 35.6895, longitude: 139.6917 };
      const localID = generateShardID('local', loc);
      const regionalID = generateShardID('regional', loc);

      expect(localID).toContain('local');
      expect(regionalID).toContain('regional');
    });
  });

  describe('CrossShardRouter', () => {
    let router: CrossShardRouter;

    beforeEach(() => {
      router = new CrossShardRouter();
    });

    describe('registerShard', () => {
      it('should register a shard', () => {
        const shard = new GeoShard({
          level: 'local',
          shardID: 'test',
          maxPeers: 100,
          replicationFactor: 1,
        });

        router.registerShard(shard);
        const info = router.getAllShardInfo();
        expect(info.length).toBe(1);
        expect(info[0].shardID).toBe('test');
      });
    });

    describe('routeQuery', () => {
      it('should query local shard first', () => {
        const localShard = new GeoShard({
          level: 'local',
          shardID: 'local_test',
          maxPeers: 100,
          replicationFactor: 1,
        });
        localShard.storeData('key1', 'local_value');

        router.registerShard(localShard);
        router.setLocalShard('local_test');

        const result = router.routeQuery('key1', { latitude: 0, longitude: 0 });
        expect(result.localResults.length).toBe(1);
        expect(result.localResults[0]).toBe('local_value');
      });
    });

    describe('addPeerToShard', () => {
      it('should add peer with location', () => {
        const result = router.addPeerToShard({
          peerID: 'peer1',
          shardID: '',
          location: { latitude: 35.6895, longitude: 139.6917 },
          lastSeen: Date.now(),
          latency: 50,
          capabilities: ['chat'],
        });

        expect(result.success).toBe(true);
        expect(result.shardID).toBeDefined();
      });

      it('should reject peer without location', () => {
        const result = router.addPeerToShard({
          peerID: 'peer1',
          shardID: '',
          lastSeen: Date.now(),
          latency: 50,
          capabilities: [],
        });

        expect(result.success).toBe(false);
      });
    });

    describe('makeLoadBalanceDecision', () => {
      it('should return split decision for overloaded shard', () => {
        const smallShard = new GeoShard({
          level: 'local',
          shardID: 'small',
          maxPeers: 2,
          replicationFactor: 1,
        });
        smallShard.addPeer({ peerID: 'p1', shardID: 'small', lastSeen: Date.now(), latency: 10, capabilities: [] });
        smallShard.addPeer({ peerID: 'p2', shardID: 'small', lastSeen: Date.now(), latency: 10, capabilities: [] });

        router.registerShard(smallShard);

        const decisions = router.makeLoadBalanceDecision();
        expect(decisions.some(d => d.action === 'split')).toBe(true);
      });
    });
  });

  describe('HierarchicalDHT', () => {
    let dht: HierarchicalDHT;

    beforeEach(() => {
      dht = new HierarchicalDHT();
    });

    describe('initialize', () => {
      it('should initialize with peer location', () => {
        dht.initialize('peer1', { latitude: 35.6895, longitude: 139.6917 });

        const health = dht.getNetworkHealth();
        expect(health.totalShards).toBeGreaterThan(0);
      });
    });

    describe('announce/query', () => {
      it('should announce and retrieve data', () => {
        dht.initialize('peer1', { latitude: 35.6895, longitude: 139.6917 });

        const result = dht.announce('test_key', 'test_value', 300);
        expect(result.success).toBe(true);

        const queryResult = dht.query('test_key');
        expect(queryResult.totalResults).toBeGreaterThan(0);
      });

      it('should replicate to global when requested', () => {
        dht.initialize('peer1', { latitude: 35.6895, longitude: 139.6917 });

        dht.announce('global_key', 'global_value', 300, undefined, true);

        const queryResult = dht.query('global_key');
        expect(queryResult.globalResults.length).toBeGreaterThan(0);
      });
    });

    describe('addPeer/removePeer', () => {
      it('should add and remove peer', () => {
        const result = dht.addPeer({
          peerID: 'peer1',
          shardID: '',
          location: { latitude: 35.6895, longitude: 139.6917 },
          lastSeen: Date.now(),
          latency: 50,
          capabilities: ['chat'],
        });

        expect(result.success).toBe(true);

        dht.removePeer('peer1');
      });
    });

    describe('getNearbyPeers', () => {
      it('should return peers near location', () => {
        dht.initialize('peer1', { latitude: 35.6895, longitude: 139.6917 });

        dht.addPeer({
          peerID: 'peer2',
          shardID: '',
          location: { latitude: 35.7, longitude: 139.7 },  // Nearby
          lastSeen: Date.now(),
          latency: 10,
          capabilities: ['chat'],
        });

        dht.addPeer({
          peerID: 'peer3',
          shardID: '',
          location: { latitude: 40.7, longitude: -74.0 },  // Far away
          lastSeen: Date.now(),
          latency: 200,
          capabilities: ['chat'],
        });

        const nearby = dht.getNearbyPeers({ latitude: 35.6895, longitude: 139.6917 }, 10, 100);
        expect(nearby.length).toBeGreaterThan(0);
        expect(nearby.some(p => p.peerID === 'peer2')).toBe(true);
      });
    });

    describe('getNetworkHealth', () => {
      it('should return network health status', () => {
        dht.initialize('peer1', { latitude: 35.6895, longitude: 139.6917 });

        const health = dht.getNetworkHealth();
        expect(['healthy', 'degraded', 'critical']).toContain(health.status);
        expect(health.totalShards).toBeGreaterThan(0);
        expect(typeof health.avgHealth).toBe('number');
      });
    });

    describe('getLoadBalanceDecisions', () => {
      it('should return load balancing decisions', () => {
        dht.initialize('peer1', { latitude: 35.6895, longitude: 139.6917 });

        const decisions = dht.getLoadBalanceDecisions();
        expect(Array.isArray(decisions)).toBe(true);
      });
    });

    describe('export/import', () => {
      it('should export and import state', () => {
        dht.initialize('peer1', { latitude: 35.6895, longitude: 139.6917 });
        dht.announce('key1', 'value1', 300);

        const state = dht.export();
        const newDht = new HierarchicalDHT();
        newDht.import(state);

        const queryResult = newDht.query('key1');
        expect(queryResult.totalResults).toBeGreaterThan(0);
      });
    });
  });
});
