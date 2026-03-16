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
import { createHash } from 'crypto';
import { cosineSimilarity, lshHash, seededRng } from '../../packages/core/src/index.js';
// Cleanup handler to prevent orphan processes
let isShuttingDown = false;
function setupCleanupHandlers() {
    const cleanup = () => {
        if (isShuttingDown)
            return;
        isShuttingDown = true;
        console.log('\n[Simulator] Cleaning up...');
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', () => {
        isShuttingDown = true;
    });
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error('\n[Simulator] Uncaught exception:', err);
        cleanup();
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error('\n[Simulator] Unhandled rejection at:', promise, 'reason:', reason);
        cleanup();
    });
}
setupCleanupHandlers();
export const DEFAULT_CONFIG = {
    numPeers: 50,
    timeDilation: 1000,
    modelHash: 'allminilm',
    numHashes: 20,
    hashLen: 32,
    similarityThreshold: 0.55,
    announceInterval: 300,
    queryInterval: 60,
    ttl: 300,
    seed: 'isc-simulator-2026',
};
export class InMemoryDHT {
    entries = new Map();
    virtualTime = 0;
    setVirtualTime(time) {
        this.virtualTime = time;
    }
    getVirtualTime() {
        return this.virtualTime;
    }
    async put(key, value, ttl) {
        const expiresAt = this.virtualTime + ttl;
        const entry = { key, value, expiresAt };
        if (!this.entries.has(key)) {
            this.entries.set(key, []);
        }
        this.entries.get(key).push(entry);
    }
    async get(key) {
        const entries = this.entries.get(key) || [];
        const valid = entries.filter(e => e.expiresAt > this.virtualTime);
        return valid.map(e => e.value);
    }
    async getMany(pattern, count) {
        const results = [];
        for (const [key, entries] of this.entries.entries()) {
            if (key.includes(pattern)) {
                const valid = entries.filter(e => e.expiresAt > this.virtualTime);
                for (const entry of valid) {
                    results.push(entry.value);
                    if (results.length >= count) {
                        return results;
                    }
                }
            }
        }
        return results;
    }
    cleanup() {
        let removed = 0;
        for (const [key, entries] of this.entries.entries()) {
            const valid = entries.filter(e => e.expiresAt > this.virtualTime);
            removed += entries.length - valid.length;
            this.entries.set(key, valid);
        }
        return removed;
    }
    getStats() {
        let total = 0;
        for (const entries of this.entries.values()) {
            total += entries.length;
        }
        return {
            totalEntries: total,
            uniqueKeys: this.entries.size,
        };
    }
}
export class VirtualPeer {
    id;
    description;
    tier;
    vector;
    channel;
    metrics;
    constructor(id, description, tier = 'high') {
        this.id = id;
        this.description = description;
        this.tier = tier;
        this.vector = VirtualPeer.computeVector(description);
        this.channel = VirtualPeer.createChannel(id, description);
        this.metrics = {
            announcesSent: 0,
            queriesMade: 0,
            matchesFound: 0,
            avgSimilarity: 0,
            lastAnnounce: 0,
            lastQuery: 0,
        };
    }
    static computeVector(text) {
        // Deterministic stub embedding based on SHA256
        const hash = createHash('sha256').update(text).digest();
        const vec = Array.from({ length: 384 }, (_, i) => {
            const byte = hash[i % 32];
            return (byte / 255) * 2 - 1;
        });
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
        return vec.map(v => v / norm);
    }
    static createChannel(peerId, description) {
        return {
            id: `ch-${peerId}`,
            name: `Channel-${peerId.slice(0, 8)}`,
            description,
            spread: 0.15,
            relations: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            active: true,
        };
    }
    getVector() {
        return this.vector;
    }
    getChannel() {
        return this.channel;
    }
    async announceToDHT(dht, config) {
        const hashes = lshHash(this.vector, config.modelHash, config.numHashes, config.hashLen);
        const announcement = {
            peerID: this.id,
            channelID: this.channel.id,
            model: config.modelHash,
            vec: this.vector,
            ttl: config.ttl,
            updatedAt: Date.now(),
            signature: new Uint8Array(64), // Stub signature
        };
        // Announce to multiple LSH buckets
        for (const hash of hashes.slice(0, 5)) {
            const key = `/isc/announce/${config.modelHash}/${hash}`;
            await dht.put(key, announcement, config.ttl);
        }
        this.metrics.announcesSent++;
        this.metrics.lastAnnounce = dht.getVirtualTime();
    }
    async queryDHT(dht, config) {
        const hashes = lshHash(this.vector, config.modelHash, config.numHashes, config.hashLen);
        const candidates = new Map();
        // Query multiple LSH buckets
        for (const hash of hashes) {
            const key = `/isc/announce/${config.modelHash}/${hash}`;
            const entries = await dht.get(key);
            for (const entry of entries) {
                if (entry.peerID === this.id)
                    continue; // Skip self
                const sim = cosineSimilarity(this.vector, entry.vec);
                if (sim >= config.similarityThreshold) {
                    const existing = candidates.get(entry.peerID) || 0;
                    candidates.set(entry.peerID, Math.max(existing, sim));
                }
            }
        }
        // Convert to sorted array
        const results = Array.from(candidates.entries())
            .map(([peerID, similarity]) => ({ peerID, similarity }))
            .sort((a, b) => b.similarity - a.similarity);
        this.metrics.queriesMade++;
        this.metrics.lastQuery = dht.getVirtualTime();
        // Update metrics
        if (results.length > 0) {
            this.metrics.matchesFound += results.length;
            const totalSim = results.reduce((sum, r) => sum + r.similarity, 0);
            this.metrics.avgSimilarity = totalSim / results.length;
        }
        return results;
    }
}
export class NetworkSimulator {
    config;
    dht;
    peers = new Map();
    rng;
    virtualTime = 0;
    startTime = 0;
    firstMatchTimes = new Map();
    running = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.dht = new InMemoryDHT();
        this.rng = seededRng(this.config.seed);
    }
    async initialize(numPeers) {
        const count = numPeers || this.config.numPeers;
        // Create peers with diverse topics
        const topics = [
            'AI ethics and machine learning autonomy',
            'Distributed systems consensus algorithms CAP theorem',
            'Climate technology carbon capture renewable energy',
            'Neuroscience brain computer interfaces neural plasticity',
            'Quantum computing error correction algorithms',
            'Blockchain decentralized finance smart contracts',
            'Biotechnology gene editing CRISPR therapeutics',
            'Robotics automation autonomous systems control',
            'Cybersecurity encryption threat detection',
            'Data science machine learning statistics visualization',
        ];
        for (let i = 0; i < count; i++) {
            const topicIndex = Math.floor(this.rng() * topics.length);
            const variation = Math.floor(this.rng() * 100);
            const description = `${topics[topicIndex]} variant ${variation}`;
            const tier = this.randomTier();
            const peer = new VirtualPeer(`peer-${i.toString().padStart(4, '0')}`, description, tier);
            this.peers.set(peer.id, peer);
        }
    }
    randomTier() {
        const r = this.rng();
        if (r < 0.3)
            return 'high';
        if (r < 0.7)
            return 'mid';
        return 'low';
    }
    async run(durationSeconds) {
        this.running = true;
        this.startTime = Date.now();
        const durationVirtual = durationSeconds * this.config.timeDilation;
        console.log(`Starting simulation: ${this.peers.size} peers, ${durationSeconds}s real = ${durationVirtual}s virtual`);
        let lastAnnounceTime = 0;
        let lastQueryTime = 0;
        let lastCleanupTime = 0;
        while (this.running && this.virtualTime < durationVirtual) {
            // Advance virtual time
            this.virtualTime += this.config.timeDilation / 10; // 10 ticks per second
            this.dht.setVirtualTime(this.virtualTime);
            // Announce phase
            if (this.virtualTime - lastAnnounceTime >= this.config.announceInterval) {
                await this.runAnnouncePhase();
                lastAnnounceTime = this.virtualTime;
            }
            // Query phase
            if (this.virtualTime - lastQueryTime >= this.config.queryInterval) {
                await this.runQueryPhase();
                lastQueryTime = this.virtualTime;
            }
            // Cleanup phase
            if (this.virtualTime - lastCleanupTime >= this.config.ttl) {
                const removed = this.dht.cleanup();
                if (removed > 0) {
                    console.log(`  DHT cleanup: removed ${removed} expired entries`);
                }
                lastCleanupTime = this.virtualTime;
            }
            // Small delay to prevent CPU spinning
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this.running = false;
        return this.getMetrics();
    }
    async runAnnouncePhase() {
        const peerArray = Array.from(this.peers.values());
        // Shuffle peers for randomness
        for (let i = peerArray.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [peerArray[i], peerArray[j]] = [peerArray[j], peerArray[i]];
        }
        // Announce in batches to simulate staggered timing
        const batchSize = Math.ceil(peerArray.length / 5);
        for (let i = 0; i < peerArray.length; i += batchSize) {
            const batch = peerArray.slice(i, i + batchSize);
            await Promise.all(batch.map(peer => peer.announceToDHT(this.dht, this.config)));
        }
    }
    async runQueryPhase() {
        const peerArray = Array.from(this.peers.values());
        for (const peer of peerArray) {
            const matches = await peer.queryDHT(this.dht, this.config);
            // Track first match time
            if (matches.length > 0 && !this.firstMatchTimes.has(peer.id)) {
                this.firstMatchTimes.set(peer.id, this.virtualTime);
            }
        }
    }
    stop() {
        this.running = false;
    }
    getMetrics() {
        const peerArray = Array.from(this.peers.values());
        const totalAnnounces = peerArray.reduce((sum, p) => sum + p.metrics.announcesSent, 0);
        const totalQueries = peerArray.reduce((sum, p) => sum + p.metrics.queriesMade, 0);
        const totalMatches = peerArray.reduce((sum, p) => sum + p.metrics.matchesFound, 0);
        const peersWithMatches = peerArray.filter(p => p.metrics.matchesFound > 0).length;
        const similarities = peerArray
            .filter(p => p.metrics.matchesFound > 0)
            .map(p => p.metrics.avgSimilarity);
        const avgSimilarity = similarities.length > 0
            ? similarities.reduce((sum, s) => sum + s, 0) / similarities.length
            : 0;
        const firstMatchTimes = Array.from(this.firstMatchTimes.values());
        firstMatchTimes.sort((a, b) => a - b);
        const p50Index = Math.floor(firstMatchTimes.length * 0.5);
        const p95Index = Math.floor(firstMatchTimes.length * 0.95);
        const timeToFirstMatch = {
            p50: firstMatchTimes[p50Index] || 0,
            p95: firstMatchTimes[p95Index] || 0,
            avg: firstMatchTimes.length > 0
                ? firstMatchTimes.reduce((sum, t) => sum + t, 0) / firstMatchTimes.length
                : 0,
        };
        return {
            totalPeers: this.peers.size,
            activePeers: peerArray.filter(p => p.metrics.announcesSent > 0).length,
            totalAnnounces,
            totalQueries,
            totalMatches,
            avgMatchesPerPeer: totalMatches / this.peers.size,
            avgSimilarity,
            dhtEntries: this.dht.getStats().totalEntries,
            virtualTimeElapsed: this.virtualTime,
            realTimeElapsed: Date.now() - this.startTime,
            peersWithMatches,
            timeToFirstMatch,
        };
    }
    getDHT() {
        return this.dht;
    }
    getPeers() {
        return this.peers;
    }
}
// ============================================================================
// CLI Runner
// ============================================================================
async function main() {
    const args = process.argv.slice(2);
    const numPeers = parseInt(args.find(a => a.startsWith('--peers='))?.split('=')[1] || '50');
    const duration = parseInt(args.find(a => a.startsWith('--duration='))?.split('=')[1] || '30');
    const seed = args.find(a => a.startsWith('--seed='))?.split('=')[1] || 'isc-simulator';
    console.log('='.repeat(60));
    console.log('ISC Network Simulator');
    console.log('='.repeat(60));
    console.log(`Peers: ${numPeers}`);
    console.log(`Duration: ${duration}s real time`);
    console.log(`Seed: ${seed}`);
    console.log('='.repeat(60));
    console.log();
    const simulator = new NetworkSimulator({
        numPeers,
        seed,
        timeDilation: 1000,
        announceInterval: 300,
        queryInterval: 60,
        ttl: 300,
    });
    console.log('Initializing peers...');
    await simulator.initialize(numPeers);
    console.log(`Created ${numPeers} virtual peers`);
    console.log();
    console.log('Running simulation...');
    const metrics = await simulator.run(duration);
    console.log();
    console.log('='.repeat(60));
    console.log('Simulation Results');
    console.log('='.repeat(60));
    console.log(`Total Peers:        ${metrics.totalPeers}`);
    console.log(`Active Peers:       ${metrics.activePeers}`);
    console.log(`Total Announces:    ${metrics.totalAnnounces}`);
    console.log(`Total Queries:      ${metrics.totalQueries}`);
    console.log(`Total Matches:      ${metrics.totalMatches}`);
    console.log(`Avg Matches/Peer:   ${metrics.avgMatchesPerPeer.toFixed(2)}`);
    console.log(`Avg Similarity:     ${(metrics.avgSimilarity * 100).toFixed(1)}%`);
    console.log(`Peers with Matches: ${metrics.peersWithMatches} (${((metrics.peersWithMatches / metrics.totalPeers) * 100).toFixed(1)}%)`);
    console.log(`DHT Entries:        ${metrics.dhtEntries}`);
    console.log();
    console.log('Time to First Match:');
    console.log(`  P50:  ${(metrics.timeToFirstMatch.p50 / 1000).toFixed(1)}s virtual`);
    console.log(`  P95:  ${(metrics.timeToFirstMatch.p95 / 1000).toFixed(1)}s virtual`);
    console.log(`  Avg:  ${(metrics.timeToFirstMatch.avg / 1000).toFixed(1)}s virtual`);
    console.log();
    console.log(`Virtual Time:       ${(metrics.virtualTimeElapsed / 1000).toFixed(1)}s`);
    console.log(`Real Time:          ${(metrics.realTimeElapsed / 1000).toFixed(1)}s`);
    console.log(`Time Dilation:      ${metrics.realTimeElapsed > 0 ? (metrics.virtualTimeElapsed / metrics.realTimeElapsed).toFixed(0) : 'N/A'}x`);
    console.log('='.repeat(60));
    // Validate success criteria
    console.log();
    console.log('Success Criteria:');
    const criteria = [
        { name: 'Peers with matches > 80%', pass: (metrics.peersWithMatches / metrics.totalPeers) > 0.8 },
        { name: 'Avg similarity > 0.55', pass: metrics.avgSimilarity >= 0.55 },
        { name: 'P50 first match < 10s', pass: metrics.timeToFirstMatch.p50 < 10000 },
        { name: 'DHT entries > 0', pass: metrics.dhtEntries > 0 },
    ];
    let allPassed = true;
    for (const { name, pass } of criteria) {
        console.log(`  ${pass ? '✓' : '✗'} ${name}`);
        if (!pass)
            allPassed = false;
    }
    console.log();
    if (allPassed) {
        console.log('✓ All success criteria met!');
        process.exit(0);
    }
    else {
        console.log('✗ Some success criteria not met');
        process.exit(1);
    }
}
// Run if executed directly
if (process.argv[1]?.endsWith('simulator.js')) {
    main().catch(err => {
        console.error('Simulation failed:', err);
        process.exit(1);
    });
}
export { main };
//# sourceMappingURL=simulator.js.map