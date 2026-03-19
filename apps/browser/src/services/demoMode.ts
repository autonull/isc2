/**
 * Demo Mode Service
 *
 * Injects synthetic peers when real peer count is low (< 3).
 * Simulates a populated network for cold-start perception.
 *
 * Features:
 * - Generates realistic synthetic peers with semantic embeddings
 * - Simulates peer activity (posts, messages)
 * - Configurable peer count threshold
 * - Auto-disables when real peers connect
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
  minRealPeers: number; // Show synthetic peers when real count < this
  maxSyntheticPeers: number;
  peerLifetimeMs: number; // How long synthetic peers stay visible
  activitySimulation: boolean; // Simulate posts/messages from synthetic peers
}

const DEFAULT_CONFIG: DemoModeConfig = {
  enabled: true,
  minRealPeers: 3,
  maxSyntheticPeers: 10,
  peerLifetimeMs: 3600000, // 1 hour
  activitySimulation: true,
};

// Synthetic peer name pools for realistic generation
const NAME_PREFIXES = [
  'Alex', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Quinn', 'Avery',
  'Cameron', 'Dakota', 'Emerson', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jamie',
];

const NAME_SUFFIXES = [
  'thoughts', 'ideas', 'muses', 'vibes', 'waves', 'flows', 'seeks', 'shares',
  'explores', 'discovers', 'creates', 'builds', 'learns', 'grows', 'connects',
];

const BIO_TEMPLATES = [
  'Interested in {topic1} and {topic2}. Always learning something new.',
  'Passionate about {topic1}. Love discussing {topic2}.',
  'Exploring {topic1}, {topic2}, and everything in between.',
  '{topic1} enthusiast. Curious about {topic2}.',
  'Sharing thoughts on {topic1} and {topic2}.',
  'Deep thinker into {topic1}. Also love {topic2}.',
  'On a journey through {topic1} and {topic2}.',
];

const TOPIC_POOLS = {
  tech: ['AI', 'machine learning', 'blockchain', 'web3', 'open source', 'programming', 'rust', 'typescript', 'distributed systems'],
  science: ['physics', 'biology', 'neuroscience', 'climate', 'space', 'quantum computing', 'genetics'],
  arts: ['music', 'photography', 'design', 'writing', 'film', 'digital art', 'generative art'],
  philosophy: ['consciousness', 'ethics', 'metaphysics', 'epistemology', 'stoicism', 'existentialism'],
  lifestyle: ['meditation', 'fitness', 'cooking', 'travel', 'minimalism', 'productivity'],
  society: ['economics', 'politics', 'education', 'social systems', 'community building'],
};

const ACTIVITY_MESSAGES = [
  'Just discovered something fascinating about {topic}...',
  'Been thinking a lot about {topic} lately.',
  'Anyone else interested in {topic}? Would love to discuss.',
  'Reading about {topic} - mind blown! 🤯',
  'Working on a project related to {topic}. Exciting times!',
  'Hot take on {topic}: it\'s more nuanced than people think.',
  'Question for the group: what\'s your experience with {topic}?',
];

export class DemoModeService {
  private config: DemoModeConfig;
  private syntheticPeers = new Map<string, SyntheticPeer>();
  private realPeerCount = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private activityTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(peers: SyntheticPeer[]) => void> = new Set();
  private embeddingCache = new Map<string, number[]>();

  constructor(config: Partial<DemoModeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize demo mode
   */
  start(): void {
    if (!this.config.enabled) return;

    console.log('[DemoMode] Starting with config:', this.config);

    // Periodic refresh to add/remove synthetic peers
    this.refreshTimer = setInterval(() => {
      this.refreshSyntheticPeers();
    }, 30000); // Check every 30 seconds

    // Simulate activity from synthetic peers
    if (this.config.activitySimulation) {
      this.activityTimer = setInterval(() => {
        this.simulateActivity();
      }, 60000); // Every minute
    }
  }

  /**
   * Stop demo mode
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
    this.syntheticPeers.clear();
    this.emitUpdate();
  }

  /**
   * Update real peer count
   */
  setRealPeerCount(count: number): void {
    const changed = this.realPeerCount !== count;
    this.realPeerCount = count;

    if (changed) {
      console.log('[DemoMode] Real peer count:', count);
      this.refreshSyntheticPeers();
    }
  }

  /**
   * Get combined peers (real + synthetic)
   */
  getPeers(realPeers: PeerMatch[]): PeerMatch[] {
    if (!this.config.enabled || this.realPeerCount >= this.config.minRealPeers) {
      return realPeers;
    }

    const synthetic = Array.from(this.syntheticPeers.values());
    return [...realPeers, ...synthetic];
  }

  /**
   * Check if a peer is synthetic
   */
  isSynthetic(peerId: string): boolean {
    return this.syntheticPeers.has(peerId);
  }

  /**
   * Subscribe to synthetic peer updates
   */
  onUpdate(callback: (peers: SyntheticPeer[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Generate synthetic embedding based on topics
   */
  private generateEmbedding(topics: string[]): number[] {
    const cacheKey = topics.sort().join(',');
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    // Generate a deterministic 384-dim embedding based on topics
    // In production, this would use real embedding model
    const embedding = new Array(384).fill(0);
    
    topics.forEach((topic, idx) => {
      const seed = this.hashString(topic);
      for (let i = 0; i < 384; i++) {
        embedding[i] += Math.sin(seed * (i + 1) * 0.1) * 0.1;
      }
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < 384; i++) {
        embedding[i] /= magnitude;
      }
    }

    this.embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  /**
   * Generate synthetic peer
   */
  private generateSyntheticPeer(): SyntheticPeer {
    const id = `synthetic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Select random topics from different pools
    const poolKeys = Object.keys(TOPIC_POOLS) as Array<keyof typeof TOPIC_POOLS>;
    const selectedPools = this.shuffleArray(poolKeys).slice(0, 2);
    const topics = selectedPools.flatMap(pool => 
      this.shuffleArray(TOPIC_POOLS[pool]).slice(0, 2)
    );

    // Generate name
    const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
    const name = `${prefix}_${suffix}`;

    // Generate bio
    const template = BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)];
    const bio = template
      .replace('{topic1}', topics[0] || 'ideas')
      .replace('{topic2}', topics[1] || 'learning');

    // Generate embedding
    const embedding = this.generateEmbedding(topics);

    // Calculate similarity to "average" user (center of embedding space)
    const similarity = 0.3 + Math.random() * 0.5; // 0.3 - 0.8

    const now = Date.now();
    
    return {
      peerId: id,
      identity: {
        name,
        bio,
      },
      similarity,
      matchedTopics: topics,
      online: Math.random() > 0.3, // 70% chance of being online
      isSynthetic: true,
      expiresAt: now + this.config.peerLifetimeMs,
      activityLevel: this.selectActivityLevel(),
      topics,
      lastActive: now - Math.floor(Math.random() * 3600000), // Within last hour
      _embedding: embedding,
    } as SyntheticPeer;
  }

  private selectActivityLevel(): 'low' | 'medium' | 'high' {
    const rand = Math.random();
    if (rand < 0.5) return 'low';
    if (rand < 0.8) return 'medium';
    return 'high';
  }

  /**
   * Refresh synthetic peers
   */
  private refreshSyntheticPeers(): void {
    const now = Date.now();
    const needed = this.config.maxSyntheticPeers - this.syntheticPeers.size;

    // Remove expired peers
    for (const [id, peer] of this.syntheticPeers.entries()) {
      if (peer.expiresAt < now) {
        this.syntheticPeers.delete(id);
        console.log('[DemoMode] Removed expired synthetic peer:', id);
      }
    }

    // Add new peers if needed
    for (let i = 0; i < needed; i++) {
      const peer = this.generateSyntheticPeer();
      this.syntheticPeers.set(peer.peerId, peer);
      console.log('[DemoMode] Added synthetic peer:', peer.identity.name);
    }

    this.emitUpdate();
  }

  /**
   * Simulate activity from synthetic peers
   */
  private simulateActivity(): void {
    const activePeers = Array.from(this.syntheticPeers.values())
      .filter(p => p.online && p.activityLevel !== 'low');

    if (activePeers.length === 0) return;

    // Pick a random active peer to "post"
    const peer = activePeers[Math.floor(Math.random() * activePeers.length)];
    const topic = peer.topics[Math.floor(Math.random() * peer.topics.length)];
    
    const message = ACTIVITY_MESSAGES[Math.floor(Math.random() * ACTIVITY_MESSAGES.length)]
      .replace('{topic}', topic);

    peer.lastActive = Date.now();
    
    console.log('[DemoMode] Simulated activity:', peer.identity.name, '-', message);
    
    // Emit activity event (could trigger UI notification)
    this.emitActivity(peer, message);
  }

  private emitUpdate(): void {
    const peers = Array.from(this.syntheticPeers.values());
    this.listeners.forEach(listener => listener(peers));
  }

  private emitActivity(peer: SyntheticPeer, message: string): void {
    // Could dispatch custom event for UI to show notification
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('isc:demo-activity', {
        detail: { peer, message },
      }));
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
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

  /**
   * Get demo mode status
   */
  getStatus(): {
    enabled: boolean;
    isActive: boolean;
    realPeerCount: number;
    syntheticPeerCount: number;
    config: DemoModeConfig;
  } {
    const isActive = this.config.enabled && this.realPeerCount < this.config.minRealPeers;
    return {
      enabled: this.config.enabled,
      isActive,
      realPeerCount: this.realPeerCount,
      syntheticPeerCount: this.syntheticPeers.size,
      config: { ...this.config },
    };
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<DemoModeConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('[DemoMode] Config updated:', this.config);
    
    if (!this.config.enabled) {
      this.stop();
    } else if (!this.refreshTimer) {
      this.start();
    }
  }
}

// Singleton instance
let _instance: DemoModeService | null = null;

export function getDemoModeService(config?: Partial<DemoModeConfig>): DemoModeService {
  if (!_instance) {
    _instance = new DemoModeService(config);
  }
  return _instance;
}
