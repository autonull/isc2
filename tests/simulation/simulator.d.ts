/**
 * ISC Network Simulator
 *
 * Simulates 50+ virtual peers in a single Node.js process for scale testing.
 * Uses in-memory DHT and deterministic embedding stubs for reproducibility.
 *
 * Features:
 * - Virtual time (dilation configurable)
 * - Deterministic RNG for reproducible tests
 * - In-memory DHT with TTL expiry
 * - Stub embeddings (SHA256-based)
 * - Metrics collection (latency, match rates, etc.)
 * - Proper cleanup on exit (no orphan processes)
 */
import type { Channel, SignedAnnouncement } from '../../packages/core/src/types.js';
export interface SimulatorConfig {
    numPeers: number;
    timeDilation: number;
    modelHash: string;
    numHashes: number;
    hashLen: number;
    similarityThreshold: number;
    announceInterval: number;
    queryInterval: number;
    ttl: number;
    seed: string;
}
export declare const DEFAULT_CONFIG: SimulatorConfig;
export declare class InMemoryDHT {
    private entries;
    private virtualTime;
    setVirtualTime(time: number): void;
    getVirtualTime(): number;
    put(key: string, value: SignedAnnouncement, ttl: number): Promise<void>;
    get(key: string): Promise<SignedAnnouncement[]>;
    getMany(pattern: string, count: number): Promise<SignedAnnouncement[]>;
    cleanup(): number;
    getStats(): {
        totalEntries: number;
        uniqueKeys: number;
    };
}
export interface PeerMetrics {
    announcesSent: number;
    queriesMade: number;
    matchesFound: number;
    avgSimilarity: number;
    lastAnnounce: number;
    lastQuery: number;
}
export declare class VirtualPeer {
    readonly id: string;
    readonly description: string;
    readonly tier: 'high' | 'mid' | 'low';
    private vector;
    private channel;
    metrics: PeerMetrics;
    constructor(id: string, description: string, tier?: 'high' | 'mid' | 'low');
    private static computeVector;
    private static createChannel;
    getVector(): number[];
    getChannel(): Channel;
    announceToDHT(dht: InMemoryDHT, config: SimulatorConfig): Promise<void>;
    queryDHT(dht: InMemoryDHT, config: SimulatorConfig): Promise<{
        peerID: string;
        similarity: number;
    }[]>;
}
export interface SimulationMetrics {
    totalPeers: number;
    activePeers: number;
    totalAnnounces: number;
    totalQueries: number;
    totalMatches: number;
    avgMatchesPerPeer: number;
    avgSimilarity: number;
    dhtEntries: number;
    virtualTimeElapsed: number;
    realTimeElapsed: number;
    peersWithMatches: number;
    timeToFirstMatch: {
        p50: number;
        p95: number;
        avg: number;
    };
}
export declare class NetworkSimulator {
    private config;
    private dht;
    private peers;
    private rng;
    private virtualTime;
    private startTime;
    private firstMatchTimes;
    private running;
    constructor(config?: Partial<SimulatorConfig>);
    initialize(numPeers?: number): Promise<void>;
    private randomTier;
    run(durationSeconds: number): Promise<SimulationMetrics>;
    private runAnnouncePhase;
    private runQueryPhase;
    stop(): void;
    getMetrics(): SimulationMetrics;
    getDHT(): InMemoryDHT;
    getPeers(): Map<string, VirtualPeer>;
}
declare function main(): Promise<void>;
export { main };
//# sourceMappingURL=simulator.d.ts.map