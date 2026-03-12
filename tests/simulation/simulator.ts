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
import type { Channel, SignedAnnouncement } from '../../packages/core/src/types.js';

// Cleanup handler to prevent orphan processes
let isShuttingDown = false;

function setupCleanupHandlers() {
  const cleanup = () => {
    if (isShuttingDown) return;
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

// ============================================================================
// Configuration
// ============================================================================

export interface SimulatorConfig {
  numPeers: number;
  timeDilation: number;      // 1 real second = N virtual seconds
  modelHash: string;
  numHashes: number;
  hashLen: number;
  similarityThreshold: number;
  announceInterval: number;  // Virtual seconds between announces
  queryInterval: number;     // Virtual seconds between queries
  ttl: number;               // Virtual seconds until expiry
  seed: string;              // For deterministic RNG
}

export const DEFAULT_CONFIG: SimulatorConfig = {
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

// ============================================================================
// In-Memory DHT
// ============================================================================

interface DHTEntry {
  key: string;
  value: SignedAnnouncement;
  expiresAt: number;  // Virtual time
}

export class InMemoryDHT {
  private entries: Map<string, DHTEntry[]> = new Map();
  private virtualTime: number = 0;

  setVirtualTime(time: number): void {
    this.virtualTime = time;
  }

  getVirtualTime(): number {
    return this.virtualTime;
  }

  async put(key: string, value: SignedAnnouncement, ttl: number): Promise<void> {
    const expiresAt = this.virtualTime + ttl;
    const entry: DHTEntry = { key, value, expiresAt };

    if (!this.entries.has(key)) {
      this.entries.set(key, []);
    }
    this.entries.get(key)!.push(entry);
  }

  async get(key: string): Promise<SignedAnnouncement[]> {
    const entries = this.entries.get(key) || [];
    const valid = entries.filter(e => e.expiresAt > this.virtualTime);
    return valid.map(e => e.value);
  }

  async getMany(pattern: string, count: number): Promise<SignedAnnouncement[]> {
    const results: SignedAnnouncement[] = [];
    
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

  cleanup(): number {
    let removed = 0;
    for (const [key, entries] of this.entries.entries()) {
      const valid = entries.filter(e => e.expiresAt > this.virtualTime);
      removed += entries.length - valid.length;
      this.entries.set(key, valid);
    }
    return removed;
  }

  getStats(): { totalEntries: number; uniqueKeys: number } {
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

// ============================================================================
// Virtual Peer
// ============================================================================

export interface PeerMetrics {
  announcesSent: number;
  queriesMade: number;
  matchesFound: number;
  avgSimilarity: number;
  lastAnnounce: number;
  lastQuery: number;
}

export class VirtualPeer {
  readonly id: string;
  readonly description: string;
  readonly tier: 'high' | 'mid' | 'low';
  private vector: number[];
  private channel: Channel;
  metrics: PeerMetrics;

  constructor(
    id: string,
    description: string,
    tier: 'high' | 'mid' | 'low' = 'high'
  ) {
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

  private static computeVector(text: string): number[] {
    // Deterministic stub embedding based on SHA256
    const hash = createHash('sha256').update(text).digest();
    const vec = Array.from({ length: 384 }, (_, i) => {
      const byte = hash[i % 32];
      return (byte / 255) * 2 - 1;
    });
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return vec.map(v => v / norm);
  }

  private static createChannel(peerId: string, description: string): Channel {
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

  getVector(): number[] {
    return this.vector;
  }

  getChannel(): Channel {
    return this.channel;
  }

  async announceToDHT(dht: InMemoryDHT, config: SimulatorConfig): Promise<void> {
    const hashes = lshHash(this.vector, config.modelHash, config.numHashes, config.hashLen);
    
    const announcement: SignedAnnouncement = {
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

  async queryDHT(dht: InMemoryDHT, config: SimulatorConfig): Promise<{ peerID: string; similarity: number }[]> {
    const hashes = lshHash(this.vector, config.modelHash, config.numHashes, config.hashLen);
    const candidates: Map<string, number> = new Map();

    // Query multiple LSH buckets
    for (const hash of hashes) {
      const key = `/isc/announce/${config.modelHash}/${hash}`;
      const entries = await dht.get(key);
      
      for (const entry of entries) {
        if (entry.peerID === this.id) continue; // Skip self
        
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

// ============================================================================
// Network Simulator
// ============================================================================

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
  timeToFirstMatch: { p50: number; p95: number; avg: number };
}

export class NetworkSimulator {
  private config: SimulatorConfig;
  private dht: InMemoryDHT;
  private peers: Map<string, VirtualPeer> = new Map();
  private rng: () => number;
  private virtualTime: number = 0;
  private startTime: number = 0;
  private firstMatchTimes: Map<string, number> = new Map();
  private running: boolean = false;

  constructor(config: Partial<SimulatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dht = new InMemoryDHT();
    this.rng = seededRng(this.config.seed);
  }

  async initialize(numPeers?: number): Promise<void> {
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

  private randomTier(): 'high' | 'mid' | 'low' {
    const r = this.rng();
    if (r < 0.3) return 'high';
    if (r < 0.7) return 'mid';
    return 'low';
  }

  async run(durationSeconds: number): Promise<SimulationMetrics> {
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

  private async runAnnouncePhase(): Promise<void> {
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

  private async runQueryPhase(): Promise<void> {
    const peerArray = Array.from(this.peers.values());
    
    for (const peer of peerArray) {
      const matches = await peer.queryDHT(this.dht, this.config);
      
      // Track first match time
      if (matches.length > 0 && !this.firstMatchTimes.has(peer.id)) {
        this.firstMatchTimes.set(peer.id, this.virtualTime);
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  getMetrics(): SimulationMetrics {
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

  getDHT(): InMemoryDHT {
    return this.dht;
  }

  getPeers(): Map<string, VirtualPeer> {
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
    if (!pass) allPassed = false;
  }

  console.log();
  if (allPassed) {
    console.log('✓ All success criteria met!');
    process.exit(0);
  } else {
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
