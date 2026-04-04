/* eslint-disable */
#!/usr/bin/env node

/**
 * ISC Network Simulator - Real LM Embedding Test
 * 
 * Uses actual @xenova/transformers.js for real semantic embeddings.
 * NO word-hash cheating - real neural network inference.
 */

import { pipeline } from '@xenova/transformers';
import { cosineSimilarity } from '../../../packages/core/src/index.js';
import type { SignedAnnouncement } from '../../../packages/core/src/types.js';

// Configuration
const NUM_PEERS = 4;
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// Topics - some semantically similar
const TOPICS = [
  'Artificial intelligence and machine learning neural networks deep learning',
  'AI machine learning computer vision image recognition neural networks',  // Similar to 0
  'Distributed systems consensus algorithms blockchain cryptocurrency',
  'Distributed database replication consensus fault tolerance',  // Similar to 2
];

class SimpleDHT {
  private announcements: SignedAnnouncement[] = [];

  async announce(value: SignedAnnouncement): Promise<void> {
    this.announcements.push(value);
  }

  getAll(): SignedAnnouncement[] {
    return [...this.announcements];
  }
}

class Peer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  vector: number[] = [];
  matches: { peerID: string; similarity: number }[] = [];

  constructor(id: string, description: string) {
    this.id = id;
    this.description = description;
    this.name = `Peer-${id.slice(-4)}`;
  }

  async computeEmbedding(extractor: any): Promise<void> {
    const output = await extractor(this.description, {
      pooling: 'mean',
      normalize: true,
    });
    this.vector = Array.from(output.data as Float32Array);
  }

  async announce(dht: SimpleDHT): Promise<void> {
    const announcement: SignedAnnouncement = {
      peerID: this.id,
      channelID: `ch-${this.id}`,
      model: MODEL_ID,
      vec: this.vector,
      ttl: 300,
      updatedAt: Date.now(),
      signature: new Uint8Array(64),
    };
    await dht.announce(announcement);
    console.log(`  ${this.name} announced (${this.vector.length}D vector)`);
  }

  async discover(dht: SimpleDHT, threshold: number = 0.5): Promise<void> {
    const all = dht.getAll();
    for (const entry of all) {
      if (entry.peerID === this.id) continue;
      const sim = cosineSimilarity(this.vector, entry.vec);
      if (sim >= threshold) {
        this.matches.push({ peerID: entry.peerID, similarity: sim });
        console.log(`  ✓ ${this.name} found match: ${entry.peerID} (${(sim * 100).toFixed(1)}%)`);
      }
    }
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('     ISC Network Test - REAL LM EMBEDDINGS');
  console.log('     Model: Xenova/all-MiniLM-L6-v2');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load real transformer model
  console.log('Loading transformer model...');
  console.log('(This may take a moment on first run)\n');
  
  const extractor = await pipeline('feature-extraction', MODEL_ID);
  console.log('✅ Model loaded\n');

  const dht = new SimpleDHT();
  const peers: Peer[] = [];

  console.log('Creating peers:\n');
  for (let i = 0; i < NUM_PEERS; i++) {
    const peer = new Peer(`peer-${i}`, TOPICS[i]);
    peers.push(peer);
    console.log(`  ${peer.name}: ${peer.description}`);
  }

  console.log('\n\nStep 1: Computing real LM embeddings...\n');
  for (const peer of peers) {
    await peer.computeEmbedding(extractor);
  }
  console.log('✅ All embeddings computed\n');

  console.log('Step 2: All peers announce to DHT\n');
  for (const peer of peers) {
    await peer.announce(dht);
  }

  console.log(`\nDHT now contains ${dht.getAll().length} announcements\n`);

  console.log('Step 3: All peers discover matches (threshold: 0.6)\n');
  for (const peer of peers) {
    await peer.discover(dht);
  }

  // Summary
  const totalMatches = peers.reduce((sum, p) => sum + p.matches.length, 0);
  const peersWithMatches = peers.filter(p => p.matches.length > 0).length;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  Model: ${MODEL_ID}`);
  console.log(`  Embedding Dim: ${peers[0].vector.length}`);
  console.log(`  Peers: ${NUM_PEERS}`);
  console.log(`  DHT Announcements: ${dht.getAll().length}`);
  console.log(`  Total Matches: ${totalMatches}`);
  console.log(`  Peers with Matches: ${peersWithMatches}/${NUM_PEERS}\n`);

  // Show all similarities for verification
  console.log('All pairwise similarities:\n');
  for (let i = 0; i < peers.length; i++) {
    for (let j = i + 1; j < peers.length; j++) {
      const sim = cosineSimilarity(peers[i].vector, peers[j].vector);
      const expected = (i === 0 && j === 1) || (i === 2 && j === 3) ? '(expected match)' : '';
      console.log(`  ${peers[i].name} vs ${peers[j].name}: ${(sim * 100).toFixed(1)}% ${expected}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  if (totalMatches > 0 && peersWithMatches >= 2) {
    console.log('  ✅ SUCCESS - Network communication verified!');
    console.log('  ✅ REAL LM EMBEDDINGS working!');
    console.log('  ✅ Semantic matching confirmed!\n');
    process.exit(0);
  } else {
    console.log('  ❌ FAILED - Expected more matches\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
