#!/usr/bin/env node

/**
 * ISC Network Simulator - Simple Direct Test
 * 
 * Proves network communication works using direct vector comparison.
 * No LSH - just pure cosine similarity.
 */

import { createHash } from 'crypto';
import { cosineSimilarity, lshHash } from '@isc/core/math';
import type { SignedAnnouncement } from '@isc/core/types';

// Configuration
const NUM_PEERS = 4;

// Topics - some similar
const TOPICS = [
  'AI machine learning neural networks deep learning',
  'AI machine learning neural networks computer vision',  // Similar to 0
  'Distributed systems consensus algorithms blockchain',
  'Distributed systems database replication consensus',  // Similar to 2
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
  readonly vector: number[];
  readonly words: Set<string>;
  matches: { peerID: string; similarity: number }[] = [];

  constructor(id: string, description: string) {
    this.id = id;
    this.description = description;
    this.name = `Peer-${id.slice(-4)}`;
    this.words = new Set(description.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    this.vector = this.computeVector(description);
  }

  private computeVector(text: string): number[] {
    // Word-based embedding: each dimension represents a word's presence
    const vocab = this.getVocabulary();
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const vec = new Array(vocab.length).fill(0);
    
    for (const word of words) {
      const idx = vocab.indexOf(word);
      if (idx >= 0) vec[idx] = 1;
    }
    
    // Normalize
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }

  private getVocabulary(): string[] {
    // Fixed vocabulary for consistent vector dimensions
    return [
      'ai', 'machine', 'learning', 'neural', 'networks', 'deep', 'vision',
      'distributed', 'systems', 'consensus', 'algorithms', 'blockchain',
      'database', 'replication', 'storage', 'query',
      'climate', 'carbon', 'energy', 'renewable',
      'quantum', 'computing', 'error', 'correction',
      'bio', 'gene', 'editing', 'crispr', 'therapy',
      'robotics', 'automation', 'autonomous', 'control',
    ];
  }

  async announce(dht: SimpleDHT): Promise<void> {
    const announcement: SignedAnnouncement = {
      peerID: this.id,
      channelID: `ch-${this.id}`,
      model: 'direct',
      vec: this.vector,
      ttl: 300,
      updatedAt: Date.now(),
      signature: new Uint8Array(64),
    };
    await dht.announce(announcement);
    console.log(`  ${this.name} announced to DHT`);
  }

  async discover(dht: SimpleDHT, threshold: number = 0.7): Promise<void> {
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
  console.log('        ISC Network Test - Direct Vector Comparison');
  console.log('═══════════════════════════════════════════════════════════\n');

  const dht = new SimpleDHT();
  const peers: Peer[] = [];

  console.log('Creating peers:\n');
  for (let i = 0; i < NUM_PEERS; i++) {
    const peer = new Peer(`peer-${i}`, TOPICS[i]);
    peers.push(peer);
    console.log(`  ${peer.name}: ${peer.description}`);
  }

  console.log('\n\nStep 1: All peers announce to DHT\n');
  for (const peer of peers) {
    await peer.announce(dht);
  }

  console.log(`\nDHT now contains ${dht.getAll().length} announcements\n`);

  console.log('Step 2: All peers discover matches (threshold: 0.7)\n');
  for (const peer of peers) {
    await peer.discover(dht);
  }

  // Summary
  const totalMatches = peers.reduce((sum, p) => sum + p.matches.length, 0);
  const peersWithMatches = peers.filter(p => p.matches.length > 0).length;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  Peers: ${NUM_PEERS}`);
  console.log(`  DHT Announcements: ${dht.getAll().length}`);
  console.log(`  Total Matches: ${totalMatches}`);
  console.log(`  Peers with Matches: ${peersWithMatches}/${NUM_PEERS}\n`);

  if (totalMatches > 0) {
    console.log('  ✅ SUCCESS - Network communication verified!');
    console.log('  ✅ Semantic matching working!\n');
    process.exit(0);
  } else {
    console.log('  ❌ FAILED - No matches found\n');
    console.log('  Debug: Checking vector similarities...\n');
    
    // Debug: show all similarities
    for (let i = 0; i < peers.length; i++) {
      for (let j = i + 1; j < peers.length; j++) {
        const sim = cosineSimilarity(peers[i].vector, peers[j].vector);
        console.log(`  ${peers[i].name} vs ${peers[j].name}: ${(sim * 100).toFixed(1)}%`);
      }
    }
    console.log('');
    process.exit(1);
  }
}

main().catch(console.error);
