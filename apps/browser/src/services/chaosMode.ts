import type { PeerMatch } from '../services/network.js';

export interface ChaosModeConfig {
  enabled: boolean;
  chaosLevel: number;
  minSimilarityOverride?: number;
  randomPeerChance: number;
  topicDiversityBoost: boolean;
  storageKey: string;
}

export interface ChaosState {
  isActive: boolean;
  chaosLevel: number;
  effectiveSimilarityThreshold: number;
  activeModifiers: string[];
}

export const CHAOS_PRESETS = {
  focused: { level: 0, label: 'Focused', description: 'Only highest similarity matches' },
  balanced: { level: 25, label: 'Balanced', description: 'Good matches with some variety' },
  exploratory: { level: 50, label: 'Exploratory', description: 'Mix of similar and diverse peers' },
  serendipitous: {
    level: 75,
    label: 'Serendipitous',
    description: 'Embrace unexpected connections',
  },
  chaotic: { level: 100, label: 'Chaotic', description: 'Maximum diversity and surprise' },
};

const DEFAULT_CONFIG: ChaosModeConfig = {
  enabled: false,
  chaosLevel: 0,
  randomPeerChance: 0.3,
  topicDiversityBoost: true,
  storageKey: 'isc:chaos-mode',
};

export class ChaosModeService {
  private config: ChaosModeConfig;
  private topicHistory = new Set<string>();
  private listeners: Set<(state: ChaosState) => void> = new Set();

  constructor(config: Partial<ChaosModeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  start(): void {
    console.log('[ChaosMode] Starting with config:', this.config);
  }

  setChaosLevel(level: number): void {
    this.config.chaosLevel = Math.max(0, Math.min(100, level));
    this.config.enabled = this.config.chaosLevel > 0;
    this.saveToStorage();
    this.emitUpdate();
  }

  toggle(): void {
    this.setChaosLevel(this.config.enabled ? 0 : 50);
  }

  applyChaos(peers: PeerMatch[], userTopics?: string[]): PeerMatch[] {
    if (!this.config.enabled || this.config.chaosLevel === 0) return peers;

    const chaosFactor = this.config.chaosLevel / 100;
    let modifiedPeers = peers.map((peer) => this.adjustSimilarity(peer, chaosFactor));

    if (this.config.topicDiversityBoost && userTopics?.length) {
      modifiedPeers = this.boostTopicDiversity(modifiedPeers, userTopics, chaosFactor);
    }

    if (chaosFactor >= 0.7) {
      modifiedPeers = this.injectRandomness(modifiedPeers, chaosFactor);
    }

    return modifiedPeers.sort(
      (a, b) => this.calculateChaosScore(b, chaosFactor) - this.calculateChaosScore(a, chaosFactor)
    );
  }

  getEffectiveThreshold(baseThreshold: number): number {
    if (!this.config.enabled) return baseThreshold;
    return Math.max(0.1, baseThreshold * (1 - (this.config.chaosLevel / 100) * 0.5));
  }

  getState(): ChaosState {
    const baseThreshold = 0.3;
    const effectiveThreshold = this.getEffectiveThreshold(baseThreshold);
    const modifiers: string[] = [];

    if (this.config.chaosLevel > 0) modifiers.push('similarity_adjust');
    if (this.config.topicDiversityBoost) modifiers.push('topic_diversity');
    if (this.config.chaosLevel >= 70) modifiers.push('random_injection');

    return {
      isActive: this.config.enabled && this.config.chaosLevel > 0,
      chaosLevel: this.config.chaosLevel,
      effectiveSimilarityThreshold: effectiveThreshold,
      activeModifiers: modifiers,
    };
  }

  getCurrentPreset(): keyof typeof CHAOS_PRESETS | null {
    const level = this.config.chaosLevel;
    return (
      (Object.entries(CHAOS_PRESETS).find(
        ([, preset]) => Math.abs(preset.level - level) < 5
      )?.[0] as keyof typeof CHAOS_PRESETS) ?? null
    );
  }

  onUpdate(callback: (state: ChaosState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  recordTopic(topic: string): void {
    this.topicHistory.add(topic);
    if (this.topicHistory.size > 50) {
      this.topicHistory = new Set([...this.topicHistory].slice(-25));
    }
  }

  clearTopicHistory(): void {
    this.topicHistory.clear();
  }

  private adjustSimilarity(peer: PeerMatch, chaosFactor: number): PeerMatch {
    const noise = (Math.random() - 0.5) * chaosFactor * 0.4;
    return { ...peer, similarity: Math.max(0, Math.min(1, peer.similarity + noise)) };
  }

  private boostTopicDiversity(
    peers: PeerMatch[],
    userTopics: string[],
    chaosFactor: number
  ): PeerMatch[] {
    return peers.map((peer) => {
      const peerTopics = peer.matchedTopics ?? [];
      const novelTopics = peerTopics.filter(
        (t) => !userTopics.includes(t) && !this.topicHistory.has(t)
      );
      if (novelTopics.length > 0) {
        return {
          ...peer,
          similarity: Math.min(
            1,
            peer.similarity +
              (novelTopics.length / Math.max(1, userTopics.length)) * chaosFactor * 0.3
          ),
        };
      }
      return peer;
    });
  }

  private injectRandomness(peers: PeerMatch[], chaosFactor: number): PeerMatch[] {
    const randomChance = this.config.randomPeerChance * chaosFactor;
    return peers.map((peer) =>
      peer.similarity < 0.4 && Math.random() < randomChance
        ? { ...peer, similarity: peer.similarity + 0.2 }
        : peer
    );
  }

  private calculateChaosScore(peer: PeerMatch, chaosFactor: number): number {
    let score = peer.similarity;
    if (chaosFactor > 0.5) {
      const diversityFactor = chaosFactor - 0.5;
      if ((peer.matchedTopics ?? []).some((t) => !this.topicHistory.has(t)))
        score += diversityFactor * 0.3;
    }
    return score;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return;
      this.config = { ...this.config, ...JSON.parse(stored) };
    } catch {
      /* Ignore */
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify({
          chaosLevel: this.config.chaosLevel,
          enabled: this.config.enabled,
          topicDiversityBoost: this.config.topicDiversityBoost,
        })
      );
    } catch {
      /* Ignore */
    }
  }

  private emitUpdate(): void {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  configure(updates: Partial<ChaosModeConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveToStorage();
    this.emitUpdate();
  }
}

let _instance: ChaosModeService | null = null;

export function getChaosModeService(config?: Partial<ChaosModeConfig>): ChaosModeService {
  if (!_instance) _instance = new ChaosModeService(config);
  return _instance;
}
