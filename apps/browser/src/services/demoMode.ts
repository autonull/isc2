/* eslint-disable */
import type { PeerMatch } from './network.ts';

export interface SyntheticPeer extends PeerMatch {
  isSynthetic: true;
  expiresAt: number;
  activityLevel: 'low' | 'medium' | 'high';
  topics: string[];
  lastActive: number;
  _embedding?: number[];
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
} as const;

const ACTIVITY_THRESHOLDS = { medium: 0.5, high: 0.8 };

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
    this.refreshTimer ??= setInterval(() => this.refreshSyntheticPeers(), 30000);
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
    return [...realPeers, ...this.syntheticPeers.values()];
  }

  isSynthetic(peerId: string): boolean {
    return this.syntheticPeers.has(peerId);
  }

  onUpdate(callback: (peers: SyntheticPeer[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private generateSyntheticPeer(): SyntheticPeer {
    const now = Date.now();
    const poolKeys = Object.keys(TOPIC_POOLS) as (keyof typeof TOPIC_POOLS)[];
    const selectedPools = this.shuffleArray([...poolKeys]).slice(0, 2);
    const topics = selectedPools.flatMap((pool) =>
      this.shuffleArray([...TOPIC_POOLS[pool]]).slice(0, 2)
    );

    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const name = `${pick(NAME_PREFIXES)}_${pick(NAME_SUFFIXES)}`;
    const template = pick(BIO_TEMPLATES);
    const bio = template
      .replace('{topic1}', topics[0] ?? 'ideas')
      .replace('{topic2}', topics[1] ?? 'learning');

    return {
      peerId: `synthetic_${now}_${Math.random().toString(36).slice(2, 8)}`,
      identity: { name, bio },
      similarity: 0.3 + Math.random() * 0.5,
      matchedTopics: topics,
      online: Math.random() > 0.3,
      isSynthetic: true,
      expiresAt: now + this.config.peerLifetimeMs,
      activityLevel: this.selectActivityLevel(),
      topics,
      lastActive: now - Math.floor(Math.random() * 3600000),
      _embedding: this.generateEmbedding(topics),
    };
  }

  private selectActivityLevel(): 'low' | 'medium' | 'high' {
    const rand = Math.random();
    if (rand >= ACTIVITY_THRESHOLDS.high) return 'high';
    if (rand >= ACTIVITY_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  private refreshSyntheticPeers(): void {
    const now = Date.now();

    this.syntheticPeers.forEach((peer, id) => {
      if (peer.expiresAt < now) this.syntheticPeers.delete(id);
    });

    const needed = this.config.maxSyntheticPeers - this.syntheticPeers.size;
    if (needed > 0) {
      Array.from({ length: needed }, () => this.generateSyntheticPeer()).forEach((peer) =>
        this.syntheticPeers.set(peer.peerId, peer)
      );
    }

    this.emitUpdate();
  }

  private generateEmbedding(topics: string[]): number[] {
    const cacheKey = topics.slice().sort().join(',');
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) return cached;

    const embedding = new Array(384).fill(0);
    topics.forEach((topic) => {
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
    this.listeners.forEach((listener) => listener([...this.syntheticPeers.values()]));
  }

  private hashString(str: string): number {
    return [...str].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getStatus() {
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
    else this.start();
  }
}

let _instance: DemoModeService | null = null;

export function getDemoModeService(config?: Partial<DemoModeConfig>): DemoModeService {
  if (!_instance) _instance = new DemoModeService(config);
  return _instance;
}
