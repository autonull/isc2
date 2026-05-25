/* eslint-disable */
/**
 * Announce Channel Command
 *
 * Announces channel to DHT with rate limiting (5/min per PROTOCOL.md)
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { lshHash, seededRng, computeRelationalDistributions } from '@isc/core';
import { nodeModel } from '@isc/adapters/node';
import { DHT_KEYS } from '@isc/protocol';
import type { CLIConfig } from '../config.js';
import type { Channel, SignedAnnouncement } from '@isc/core';

const LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2';
const ANNOUNCE_RATE_LIMIT = 5; // per minute
const RATE_WINDOW_MS = 60000;

interface RateLimitState {
  timestamps: number[];
}

function getRateLimitState(config: CLIConfig): RateLimitState {
  const rateLimitFile = path.join(config.cacheDir, 'announce-rate.json');
  try {
    if (fs.existsSync(rateLimitFile)) {
      return JSON.parse(fs.readFileSync(rateLimitFile, 'utf-8'));
    }
  } catch {
    // Ignore read errors
  }
  return { timestamps: [] };
}

function saveRateLimitState(config: CLIConfig, state: RateLimitState): void {
  const rateLimitFile = path.join(config.cacheDir, 'announce-rate.json');
  fs.writeFileSync(rateLimitFile, JSON.stringify(state));
}

function checkRateLimit(config: CLIConfig): { allowed: boolean; retryAfter?: number } {
  const state = getRateLimitState(config);
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  
  // Filter out timestamps outside the window
  state.timestamps = state.timestamps.filter(ts => ts > windowStart);
  
  if (state.timestamps.length >= ANNOUNCE_RATE_LIMIT) {
    const oldestInWindow = Math.min(...state.timestamps);
    const retryAfter = Math.ceil((oldestInWindow + RATE_WINDOW_MS - now) / 1000);
    saveRateLimitState(config, state);
    return { allowed: false, retryAfter };
  }
  
  // Add current timestamp
  state.timestamps.push(now);
  saveRateLimitState(config, state);
  return { allowed: true };
}

async function loadIdentity(config: CLIConfig): Promise<{ peerID: string; keypair: { publicKey: CryptoKey; privateKey: CryptoKey } } | null> {
  try {
    if (!fs.existsSync(config.identityPath)) {
      return null;
    }
    const identity = JSON.parse(fs.readFileSync(config.identityPath, 'utf-8'));
    
    // For CLI, we'll use a simplified identity format
    // In production, this would load actual ed25519 keys
    return {
      peerID: identity.peerID || 'cli-peer-' + Date.now(),
      keypair: await crypto.subtle.generateKey(
        { name: 'Ed25519', namedCurve: 'Ed25519' },
        true,
        ['sign', 'verify']
      ) as unknown as { publicKey: CryptoKey; privateKey: CryptoKey }
    };
  } catch {
    return null;
  }
}

async function signAnnouncement(payload: any, keypair: { publicKey: CryptoKey; privateKey: CryptoKey }): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign('Ed25519', keypair.privateKey, data);
  return new Uint8Array(signature);
}

async function announceToDHT(config: CLIConfig, announcement: SignedAnnouncement): Promise<void> {
  // In production, this would use libp2p DHT
  // For now, we'll simulate by storing locally
  const dhtFile = path.join(config.cacheDir, 'dht-entries.json');
  let entries: any[] = [];
  
  try {
    if (fs.existsSync(dhtFile)) {
      entries = JSON.parse(fs.readFileSync(dhtFile, 'utf-8'));
    }
  } catch {
    // Ignore read errors
  }
  
  // Store with model hash prefix for compatibility shards
  const modelHash = LOCAL_MODEL.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const key = `/isc/announce/${modelHash}/${announcement.channelID}`;
  
  entries.push({
    key,
    value: announcement,
    expiresAt: Date.now() + (announcement.ttl * 1000)
  });
  
  fs.writeFileSync(dhtFile, JSON.stringify(entries, null, 2));
}

export function announceCommands(program: Command): void {
  const announce = program.command('announce')
    .description('Announce channels to DHT')
    .alias('ann');

  // Announce a channel
  announce
    .command('channel <channelName>')
    .description('Announce a channel to the DHT')
    .option('-r, --relations <relations>', 'Comma-separated relations (tag:object,tag:object)', '')
    .option('--spread <number>', 'Distribution spread (0.0-1.0)', '0.15')
    .option('--force', 'Bypass rate limit', false)
    .action(async (channelName: string, options: { relations: string; spread: string; force: boolean }) => {
      try {
        const config = (program as any).config as CLIConfig;
        
        // Check rate limit
        if (!options.force) {
          const rateCheck = checkRateLimit(config);
          if (!rateCheck.allowed) {
            console.error(`Rate limit exceeded. Try again in ${rateCheck.retryAfter}s`);
            console.error('Or use --force to bypass (not recommended)');
            process.exit(1);
          }
        }

        // Load identity
        const identity = await loadIdentity(config);
        if (!identity) {
          console.error('No identity found. Run `isc init` first.');
          process.exit(1);
        }

        // Load channel
        const channelsFile = path.join(config.dataDir, 'channels.json');
        if (!fs.existsSync(channelsFile)) {
          console.error('No channels found. Create one with `isc channel create`');
          process.exit(1);
        }

        const channels: Channel[] = JSON.parse(fs.readFileSync(channelsFile, 'utf-8'));
        const channel = channels.find(c => c.name === channelName);
        
        if (!channel) {
          console.error(`Channel #${channelName} not found`);
          process.exit(1);
        }

        // Parse relations
        const relations = options.relations
          ? options.relations.split(',').map((r: string) => {
              const [tag, object] = r.split(':');
              return { tag: tag.trim(), object: object?.trim() || '', weight: 1.0 };
            })
          : (channel.relations || []);

        // Compute distributions using nodeModel
        if (!nodeModel.isLoaded()) {
          console.log(`Loading embedding model for CLI: ${LOCAL_MODEL}...`);
          await nodeModel.load(LOCAL_MODEL);
        }
        
        const distributions = await computeRelationalDistributions(
          { ...channel, relations },
          { embed: async (text: string) => nodeModel.embed(text) }
        );

        // Generate LSH hashes
        const modelHash = LOCAL_MODEL.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
        const hashes = lshHash(distributions[0].mu, modelHash, 20, 32);

        // Create and sign announcement
        const basePayload = {
          peerID: identity.peerID,
          channelID: channel.id,
          model: LOCAL_MODEL,
          vec: distributions[0].mu,
          ttl: 300, // 5 minutes
          updatedAt: Date.now()
        };

        const signature = await signAnnouncement(basePayload, identity.keypair);

        const announcement: SignedAnnouncement = {
          ...basePayload,
          signature
        };

        // Announce to DHT (one announcement per distribution, up to tier limit)
        const maxAnnouncements = 5; // High tier announces all
        for (const dist of distributions.slice(0, maxAnnouncements)) {
          const distAnnouncement: SignedAnnouncement = {
            ...announcement,
            vec: dist.mu,
            relTag: dist.tag
          };
          
          await announceToDHT(config, distAnnouncement);
        }

        console.log('✓ Channel announced to DHT');
        console.log(`  Channel: #${channel.name}`);
        console.log(`  Model: ${LOCAL_MODEL}`);
        console.log(`  LSH hashes: ${hashes.length}`);
        console.log(`  TTL: ${announcement.ttl}s`);
        console.log(`  Rate limit: ${ANNOUNCE_RATE_LIMIT}/min`);
        if (distributions.length > 1) {
          console.log(`  Relations announced: ${distributions.length - 1}`);
        }

      } catch (error) {
        console.error('Failed to announce channel:', error);
        process.exit(1);
      }
    });

  // Show rate limit status
  announce
    .command('status')
    .description('Show announce rate limit status')
    .action(() => {
      try {
        const config = (program as any).config as CLIConfig;
        const state = getRateLimitState(config);
        const now = Date.now();
        const windowStart = now - RATE_WINDOW_MS;
        
        const recentCount = state.timestamps.filter(ts => ts > windowStart).length;
        const remaining = ANNOUNCE_RATE_LIMIT - recentCount;
        
        console.log('\nAnnounce Rate Limit Status\n');
        console.log(`  Used: ${recentCount}/${ANNOUNCE_RATE_LIMIT} in last minute`);
        console.log(`  Remaining: ${remaining}`);
        
        if (remaining === 0 && state.timestamps.length > 0) {
          const oldestInWindow = Math.min(...state.timestamps.filter(ts => ts > windowStart));
          const retryAfter = Math.ceil((oldestInWindow + RATE_WINDOW_MS - now) / 1000);
          console.log(`  Reset in: ${retryAfter}s`);
        }
        console.log();
        
      } catch (error) {
        console.error('Failed to get rate limit status:', error);
        process.exit(1);
      }
    });
}
