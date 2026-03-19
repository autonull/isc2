/**
 * Demo Mode Service
 *
 * Injects synthetic peers when real peer count is low (< 3).
 */

import type { PeerMatch } from '../services/network.js';

export interface SyntheticPeer extends PeerMatch {
  isSynthetic: true;
  expiresAt: number;
  activityLevel: 'low' | 'medium' | 'high';
  topics: string[];
  lastActive: number;
}

export interface DemoModeConfig {
  enabled: boolean;
  minRealPeers: number;
  maxSyntheticPeers: number;
  peerLifetimeMs: number;
  activitySimulation: boolean;
}

const DEFAULT_CONFIG: DemoModeConfig = {
  enabled: true,
  minRealPeers: 3,
  maxSyntheticPeers: 10,
  peerLifetimeMs: 3600000,
  activitySimulation: true,
};

const NAME_PREFIXES = ['Alex', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Quinn', 'Avery'];
const NAME_SUFFIXES = ['thoughts', 'ideas', 'muses', 'vibes', 'waves', 'flows', 'seeks', 'shares'];
const BIO_TEMPLATES = [
  'Interested in {topic1} and {topic2}.',
  'Passionate about {topic1}.',
  'Exploring {topic1}, {topic2}.',
  '{topic1} enthusiast.',
  'Sharing thoughts on {topic1}.',
];

const TOPIC_POOLS = {
  tech: ['AI', 'machine learning', 'blockchain', 'web3', 'open source'],
  science: ['physics', 'biology', 'neuroscience', 'climate', 'space'],
  arts: ['music', 'photography', 'design', 'writing', 'film'],
  philosophy: ['consciousness', 'ethics', 'metaphysics', 'stoicism'],
  lifestyle: ['meditation', 'fitness', 'cooking', 'travel', 'minimalism'],
};

export class DemoModeService {
  private config: DemoModeConfig;
  private syntheticPeers = new Map<string, SyntheticPeer>();
  private realPeerCount = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(peers: SyntheticPeer[]) => void> = new Set();
  private embeddingCache = new Map<string, number[]>();

  constructor(config: Partial<DemoModeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (!this.config.enabled) return;
    console.log('[DemoMode] Starting with config:', this.config);

    this.refreshTimer = setInterval(() => this.refreshSyntheticPeers(), 30000);
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.syntheticPeers.clear();
    this.emitUpdate();
  }

  setRealPeerCount(count: number): void {
    const changed = this.realPeerCount !== count;
    this.realPeerCount = count;
    if (changed) this.refreshSyntheticPeers();
  }

  getPeers(realPeers: PeerMatch[]): PeerMatch[] {
    if (!this.config.enabled || this.realPeerCount >= this.config.minRealPeers) {
      return realPeers;
    }
    const synthetic = Array.from(this.syntheticPeers.values());
    return [...realPeers, ...synthetic];
  }

  isSynthetic(peerId: string): boolean {
    return this.syntheticPeers.has(peerId);
  }

  onUpdate(callback: (peers: SyntheticPeer[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private generateSyntheticPeer(): SyntheticPeer {
    const id = `synthetic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const poolKeys = Object.keys(TOPIC_POOLS) as Array<keyof typeof TOPIC_POOLS>;
    const selectedPools = this.shuffleArray(poolKeys).slice(0, 2);
    const topics = selectedPools.flatMap(pool => this.shuffleArray(TOPIC_POOLS[pool]).slice(0, 2));

    const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
    const name = `${prefix}_${suffix}`;

    const template = BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)];
    const bio = template.replace('{topic1}', topics[0] || 'ideas').replace('{topic2}', topics[1] || 'learning');

    const embedding = this.generateEmbedding(topics);
    const similarity = 0.3 + Math.random() * 0.5;
    const now = Date.now();

    return {
      peerId: id,
      identity: { name, bio },
      similarity,
      matchedTopics: topics,
      online: Math.random() > 0.3,
      isSynthetic: true,
      expiresAt: now + this.config.peerLifetimeMs,
      activityLevel: this.selectActivityLevel(),
      topics,
      lastActive: now - Math.floor(Math.random() * 3600000),
      _embedding: embedding,
    } as SyntheticPeer;
  }

  private selectActivityLevel(): 'low' | 'medium' | 'high' {
    const rand = Math.random();
    if (rand < 0.5) return 'low';
    if (rand < 0.8) return 'medium';
    return 'high';
  }

  private refreshSyntheticPeers(): void {
    const now = Date.now();
    const needed = this.config.maxSyntheticPeers - this.syntheticPeers.size;

    for (const [id, peer] of this.syntheticPeers.entries()) {
      if (peer.expiresAt < now) {
        this.syntheticPeers.delete(id);
      }
    }

    for (let i = 0; i < needed; i++) {
      const peer = this.generateSyntheticPeer();
      this.syntheticPeers.set(peer.peerId, peer);
    }

    this.emitUpdate();
  }

  private generateEmbedding(topics: string[]): number[] {
    const cacheKey = topics.sort().join(',');
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    const embedding = new Array(384).fill(0);
    topics.forEach((topic, idx) => {
      const seed = this.hashString(topic);
      for (let i = 0; i < 384; i++) {
        embedding[i] += Math.sin(seed * (i + 1) * 0.1) * 0.1;
      }
    });

    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < 384; i++) embedding[i] /= magnitude;
    }

    this.embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  private emitUpdate(): void {
    const peers = Array.from(this.syntheticPeers.values());
    this.listeners.forEach(listener => listener(peers));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getStatus(): { enabled: boolean; isActive: boolean; realPeerCount: number; syntheticPeerCount: number } {
    const isActive = this.config.enabled && this.realPeerCount < this.config.minRealPeers;
    return {
      enabled: this.config.enabled,
      isActive,
      realPeerCount: this.realPeerCount,
      syntheticPeerCount: this.syntheticPeers.size,
    };
  }

  configure(updates: Partial<DemoModeConfig>): void {
    this.config = { ...this.config, ...updates };
    if (!this.config.enabled) this.stop();
    else if (!this.refreshTimer) this.start();
  }
}

let _instance: DemoModeService | null = null;

export function getDemoModeService(config?: Partial<DemoModeConfig>): DemoModeService {
  if (!_instance) _instance = new DemoModeService(config);
  return _instance;
}
