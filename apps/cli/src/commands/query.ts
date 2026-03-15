/**
 * Query Semantic Command
 *
 * Queries DHT for proximal peers and ranks by similarity
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { lshHash, cosineSimilarity, relationalMatch } from '@isc/core';
import { nodeModel } from '@isc/adapters/node';
import type { CLIConfig } from '../config.js';
import type { Channel, Distribution, SignedAnnouncement } from '@isc/core';

const LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2';
const SIMILARITY_THRESHOLD = 0.55;
const MAX_CANDIDATES = 100;

interface PeerCandidate {
  peerID: string;
  channelID: string;
  similarity: number;
  model: string;
  vec: number[];
  relTag?: string;
  updatedAt: number;
}

interface DHTEntry {
  key: string;
  value: SignedAnnouncement;
  expiresAt: number;
}

function loadDHTEntries(config: CLIConfig): DHTEntry[] {
  const dhtFile = path.join(config.cacheDir, 'dht-entries.json');
  try {
    if (fs.existsSync(dhtFile)) {
      return JSON.parse(fs.readFileSync(dhtFile, 'utf-8'));
    }
  } catch {
    // Ignore read errors
  }
  return [];
}

function filterExpiredEntries(entries: DHTEntry[]): DHTEntry[] {
  const now = Date.now();
  return entries.filter(e => e.expiresAt > now);
}

function verifySignature(announcement: SignedAnnouncement): boolean {
  // In production, this would verify the ed25519 signature
  // For now, we'll do a basic structure check
  return (
    announcement.signature instanceof Uint8Array &&
    announcement.signature.length > 0 &&
    typeof announcement.peerID === 'string' &&
    typeof announcement.channelID === 'string'
  );
}

async function computeQueryDistribution(config: CLIConfig, channelName?: string): Promise<{ mu: number[]; channel?: Channel } | null> {
  // Load active channel or use default
  const channelsFile = path.join(config.dataDir, 'channels.json');
  
  if (!fs.existsSync(channelsFile)) {
    return null;
  }

  const channels: Channel[] = JSON.parse(fs.readFileSync(channelsFile, 'utf-8'));
  let channel: Channel | undefined;

  if (channelName) {
    channel = channels.find(c => c.name === channelName);
  } else {
    channel = channels.find(c => c.active) || channels[0];
  }

  if (!channel) {
    return null;
  }

  // Compute distribution using real AI embeddings
  if (!nodeModel.isLoaded()) {
    console.log(`Loading embedding model for CLI: ${LOCAL_MODEL}...`);
    await nodeModel.load(LOCAL_MODEL);
  }
  
  const mu = await nodeModel.embed(channel.description);

  return {
    mu,
    channel
  };
}

async function queryDHT(config: CLIConfig, queryVec: number[]): Promise<PeerCandidate[]> {
  const entries = loadDHTEntries(config);
  const validEntries = filterExpiredEntries(entries);
  const modelHash = LOCAL_MODEL.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  
  // Generate LSH hashes for query
  const queryHashes = new Set(lshHash(queryVec, modelHash, 20, 32));
  
  const candidates: PeerCandidate[] = [];
  const seenPeers = new Set<string>();

  for (const entry of validEntries) {
    const announcement = entry.value;
    
    // Filter by model compatibility
    if (!announcement.model.includes('all-MiniLM-L6')) {
      continue;
    }
    
    // Filter by self
    if (announcement.peerID.startsWith('cli-peer-')) {
      // In production, compare actual peer IDs
      continue;
    }
    
    // Verify signature
    if (!verifySignature(announcement)) {
      continue;
    }
    
    // Check if peer already seen (deduplicate)
    if (seenPeers.has(announcement.peerID)) {
      continue;
    }
    
    // Check LSH bucket match (approximate)
    const annHashes = lshHash(announcement.vec, modelHash, 20, 32);
    const hasBucketMatch = annHashes.some(h => queryHashes.has(h));
    
    if (!hasBucketMatch) {
      continue;
    }
    
    // Compute similarity
    const similarity = cosineSimilarity(queryVec, announcement.vec);
    
    if (similarity >= SIMILARITY_THRESHOLD) {
      seenPeers.add(announcement.peerID);
      candidates.push({
        peerID: announcement.peerID,
        channelID: announcement.channelID,
        similarity,
        model: announcement.model,
        vec: announcement.vec,
        relTag: announcement.relTag,
        updatedAt: announcement.updatedAt
      });
    }
    
    if (candidates.length >= MAX_CANDIDATES) {
      break;
    }
  }

  // Sort by similarity descending
  candidates.sort((a, b) => b.similarity - a.similarity);
  
  return candidates;
}

function formatSimilarity(similarity: number): string {
  if (similarity >= 0.85) return '▐▌▐▌▐'; // Very Close
  if (similarity >= 0.70) return '▐▌▐▌░'; // Nearby
  if (similarity >= 0.55) return '▐▌░░░'; // Orbiting
  return '░░░░░'; // Distant
}

function getProximityTier(similarity: number): string {
  if (similarity >= 0.85) return 'VERY CLOSE';
  if (similarity >= 0.70) return 'NEARBY';
  if (similarity >= 0.55) return 'ORBITING';
  return 'DISTANT';
}

export function queryCommands(program: Command): void {
  const query = program.command('query')
    .description('Query DHT for semantic matches')
    .alias('q');

  // Query for semantic matches
  query
    .command('semantic [channelName]')
    .description('Query DHT for proximal peers')
    .option('--json', 'Output as JSON')
    .option('--threshold <number>', 'Similarity threshold (0.0-1.0)', '0.55')
    .option('--limit <number>', 'Maximum results', '20')
    .action(async (channelName: string, options: { json: boolean; threshold: string; limit: string }) => {
      try {
        const config = (program as any).config as CLIConfig;
        const threshold = parseFloat(options.threshold);
        const limit = parseInt(options.limit);

        // Compute query distribution
        const queryDist = await computeQueryDistribution(config, channelName);
        
        if (!queryDist) {
          console.error('No active channel found. Create one with `isc channel create`');
          process.exit(1);
        }

        // Query DHT
        const candidates = await queryDHT(config, queryDist.mu);
        
        // Filter by threshold
        const filtered = candidates.filter(c => c.similarity >= threshold);
        const results = filtered.slice(0, limit);

        if (options.json) {
          console.log(JSON.stringify({
            query: {
              channel: queryDist.channel?.name,
              description: queryDist.channel?.description
            },
            candidates: results.map(c => ({
              peerID: c.peerID,
              channelID: c.channelID,
              similarity: c.similarity,
              updatedAt: c.updatedAt
            })),
            total: results.length
          }, null, 2));
          return;
        }

        // Display results grouped by proximity tier
        console.log('\nSemantic Query Results\n');
        console.log(`Query: #${queryDist.channel?.name || 'Active Channel'}`);
        console.log(`"${queryDist.channel?.description}"`);
        console.log(`Found: ${results.length} proximal peers\n`);

        if (results.length === 0) {
          console.log('No matches found. Try:');
          console.log('  - Editing your channel description');
          console.log('  - Lowering the similarity threshold');
          console.log('  - Waiting for more peers to announce');
          console.log();
          return;
        }

        // Group by tier
        const tiers: Record<string, typeof results> = {
          'VERY CLOSE': [],
          'NEARBY': [],
          'ORBITING': []
        };

        for (const candidate of results) {
          const tier = getProximityTier(candidate.similarity);
          if (tiers[tier]) {
            tiers[tier].push(candidate);
          }
        }

        for (const [tierName, peers] of Object.entries(tiers)) {
          if (peers.length === 0) continue;

          console.log(`${tierName} (${peers.length})`);
          console.log('─'.repeat(50));

          for (const peer of peers) {
            const signalBars = formatSimilarity(peer.similarity);
            const similarityPct = Math.round(peer.similarity * 100);
            const timeAgo = Math.round((Date.now() - peer.updatedAt) / 1000);
            
            console.log(`  ${signalBars}  Peer ${peer.peerID.slice(0, 12)}...`);
            console.log(`         Similarity: ${similarityPct}%`);
            console.log(`         Channel: ${peer.channelID}`);
            console.log(`         Updated: ${timeAgo}s ago`);
            if (peer.relTag) {
              console.log(`         Relation: ${peer.relTag}`);
            }
            console.log();
          }
        }

        console.log('Tip: Use `isc dial <peerID>` to initiate chat\n');

      } catch (error) {
        console.error('Failed to query semantic matches:', error);
        process.exit(1);
      }
    });

  // Query DHT directly by key
  query
    .command('dht <key>')
    .description('Query DHT by key')
    .option('--json', 'Output as JSON')
    .action((key: string, options: { json: boolean }) => {
      try {
        const config = (program as any).config as CLIConfig;
        const entries = loadDHTEntries(config);
        const validEntries = filterExpiredEntries(entries);
        
        const results = validEntries.filter(e => e.key.includes(key));

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        console.log(`\nDHT Query: ${key}\n`);
        console.log(`Found: ${results.length} entries\n`);

        for (const entry of results.slice(0, 10)) {
          console.log(`Key: ${entry.key}`);
          console.log(`  Peer: ${entry.value.peerID}`);
          console.log(`  Channel: ${entry.value.channelID}`);
          console.log(`  Model: ${entry.value.model}`);
          console.log(`  Expires: ${new Date(entry.expiresAt).toISOString()}`);
          console.log();
        }

        if (results.length > 10) {
          console.log(`... and ${results.length - 10} more`);
        }
        console.log();

      } catch (error) {
        console.error('Failed to query DHT:', error);
        process.exit(1);
      }
    });
}
