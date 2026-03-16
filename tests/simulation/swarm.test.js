/**
 * Swarm Simulation Tests
 *
 * Tests the network simulator with various peer counts and scenarios.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkSimulator, DEFAULT_CONFIG } from './simulator.js';
describe('NetworkSimulator', () => {
    let simulator;
    beforeEach(() => {
        simulator = new NetworkSimulator({
            ...DEFAULT_CONFIG,
            numPeers: 10,
            seed: 'test-seed',
        });
    });
    it('should initialize peers', async () => {
        await simulator.initialize(10);
        const peers = simulator.getPeers();
        expect(peers.size).toBe(10);
    });
    it('should create peers with diverse topics', async () => {
        await simulator.initialize(20);
        const peers = Array.from(simulator.getPeers().values());
        const descriptions = new Set(peers.map(p => p.description.split(' variant ')[0]));
        // Should have multiple different topics
        expect(descriptions.size).toBeGreaterThan(1);
    });
    it('should run announce phase', async () => {
        await simulator.initialize(5);
        await simulator['runAnnouncePhase']();
        const dhtStats = simulator.getDHT().getStats();
        expect(dhtStats.totalEntries).toBeGreaterThan(0);
    });
    it('should find matches in query phase', async () => {
        await simulator.initialize(10);
        // Run announce first
        await simulator['runAnnouncePhase']();
        // Then query
        await simulator['runQueryPhase']();
        const metrics = simulator.getMetrics();
        expect(metrics.peersWithMatches).toBeGreaterThan(0);
    });
    it('should track time to first match', async () => {
        await simulator.initialize(10);
        // Run multiple cycles
        for (let i = 0; i < 5; i++) {
            await simulator['runAnnouncePhase']();
            simulator['virtualTime'] += 100;
            await simulator['runQueryPhase']();
        }
        const metrics = simulator.getMetrics();
        expect(metrics.timeToFirstMatch.p50).toBeGreaterThan(0);
    });
});
describe('NetworkSimulator Scale Tests', () => {
    it('should handle 50 peers', async () => {
        const simulator = new NetworkSimulator({
            numPeers: 50,
            seed: 'scale-test-50',
            timeDilation: 100,
            announceInterval: 50,
            queryInterval: 20,
            ttl: 100,
        });
        await simulator.initialize(50);
        const metrics = await simulator.run(5);
        expect(metrics.totalPeers).toBe(50);
        expect(metrics.dhtEntries).toBeGreaterThan(0);
    }, 30000);
    it('should handle 100 peers', async () => {
        const simulator = new NetworkSimulator({
            numPeers: 100,
            seed: 'scale-test-100',
            timeDilation: 100,
            announceInterval: 50,
            queryInterval: 20,
            ttl: 100,
        });
        await simulator.initialize(100);
        const metrics = await simulator.run(5);
        expect(metrics.totalPeers).toBe(100);
        expect(metrics.dhtEntries).toBeGreaterThan(0);
    }, 60000);
});
describe('NetworkSimulator Success Criteria', () => {
    it('should meet Phase 1 success criteria', async () => {
        const simulator = new NetworkSimulator({
            numPeers: 50,
            seed: 'success-criteria',
            timeDilation: 500,
            announceInterval: 100,
            queryInterval: 30,
            ttl: 200,
        });
        await simulator.initialize(50);
        const metrics = await simulator.run(10);
        // Phase 1 success criteria
        const matchRate = metrics.peersWithMatches / metrics.totalPeers;
        expect(matchRate).toBeGreaterThan(0.5); // At least 50% of peers find matches
        expect(metrics.avgSimilarity).toBeGreaterThanOrEqual(0.55);
        expect(metrics.dhtEntries).toBeGreaterThan(0);
    }, 30000);
});
//# sourceMappingURL=swarm.test.js.map