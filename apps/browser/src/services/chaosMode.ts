/**
 * Chaos Mode Service
 *
 * Serendipity slider for wider semantic range matching.
 * Introduces controlled randomness to discover diverse peers.
 *
 * Features:
 * - Adjustable chaos level (0-100%)
 * - Modifies similarity thresholds
 * - Random peer injection at high chaos
 * - Topic diversity boosting
 */

import type { PeerMatch } from '../services/network.js';

export interface ChaosModeConfig {
  enabled: boolean;
  chaosLevel: number; // 0-100
  minSimilarityOverride?: number; // Override minimum similarity threshold
  randomPeerChance: number; // Chance to show random peer at max chaos
  topicDiversityBoost: boolean; // Boost peers with different topics
  storageKey: string;
}

export interface ChaosState {
  isActive: boolean;
  chaosLevel: number;
  effectiveSimilarityThreshold: number;
  activeModifiers: string[];
}

const DEFAULT_CONFIG: ChaosModeConfig = {
  enabled: false,
  chaosLevel: 0,
  randomPeerChance: 0.3, // 30% chance at max chaos
  topicDiversityBoost: true,
  storageKey: 'isc:chaos-mode',
};

// Chaos level presets
export const CHAOS_PRESETS = {
  focused: { level: 0, label: 'Focused', description: 'Only highest similarity matches' },
  balanced: { level: 25, label: 'Balanced', description: 'Good matches with some variety' },
  exploratory: { level: 50, label: 'Exploratory', description: 'Mix of similar and diverse peers' },
  serendipitous: { level: 75, label: 'Serendipitous', description: 'Embrace unexpected connections' },
  chaotic: { level: 100, label: 'Chaotic', description: 'Maximum diversity and surprise' },
};

export class ChaosModeService {
  private config: ChaosModeConfig;
  private topicHistory = new Set<string>();
  private listeners: Set<(state: ChaosState) => void> = new Set();

  constructor(config: Partial<ChaosModeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  /**
   * Initialize chaos mode
   */
  start(): void {
    console.log('[ChaosMode] Starting with config:', this.config);
  }

  /**
   * Set chaos level
   */
  setChaosLevel(level: number): void {
    this.config.chaosLevel = Math.max(0, Math.min(100, level));
    this.config.enabled = this.config.chaosLevel > 0;
    this.saveToStorage();
    this.emitUpdate();
    console.log('[ChaosMode] Chaos level set to:', this.config.chaosLevel);
  }

  /**
   * Toggle chaos mode
   */
  toggle(): void {
    if (this.config.enabled) {
      this.setChaosLevel(0);
    } else {
      this.setChaosLevel(50); // Default to exploratory
    }
  }

  /**
   * Apply chaos to peer list
   */
  applyChaos(peers: PeerMatch[], userTopics?: string[]): PeerMatch[] {
    if (!this.config.enabled || this.config.chaosLevel === 0) {
      return peers;
    }

    const chaosFactor = this.config.chaosLevel / 100;
    let modifiedPeers = [...peers];

    // 1. Adjust similarity scores based on chaos
    modifiedPeers = modifiedPeers.map(peer => this.adjustSimilarity(peer, chaosFactor));

    // 2. Add topic diversity boost
    if (this.config.topicDiversityBoost && userTopics?.length) {
      modifiedPeers = this.boostTopicDiversity(modifiedPeers, userTopics, chaosFactor);
    }

    // 3. Inject random peers at high chaos levels
    if (chaosFactor >= 0.7) {
      modifiedPeers = this.injectRandomness(modifiedPeers, chaosFactor);
    }

    // 4. Re-sort with chaos-adjusted scores
    modifiedPeers.sort((a, b) => {
      const scoreA = this.calculateChaosScore(a, chaosFactor);
      const scoreB = this.calculateChaosScore(b, chaosFactor);
      return scoreB - scoreA;
    });

    return modifiedPeers;
  }

  /**
   * Get effective similarity threshold based on chaos
   */
  getEffectiveThreshold(baseThreshold: number): number {
    if (!this.config.enabled) return baseThreshold;

    const chaosFactor = this.config.chaosLevel / 100;
    
    // Higher chaos = lower threshold (more permissive matching)
    const reduction = chaosFactor * 0.5; // Up to 50% reduction
    return Math.max(0.1, baseThreshold * (1 - reduction));
  }

  /**
   * Get chaos state
   */
  getState(): ChaosState {
    const baseThreshold = 0.3; // Default similarity threshold
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

  /**
   * Get current preset
   */
  getCurrentPreset(): keyof typeof CHAOS_PRESETS | null {
    const level = this.config.chaosLevel;
    
    for (const [key, preset] of Object.entries(CHAOS_PRESETS)) {
      if (Math.abs(preset.level - level) < 5) {
        return key as keyof typeof CHAOS_PRESETS;
      }
    }
    
    return null;
  }

  /**
   * Subscribe to chaos state updates
   */
  onUpdate(callback: (state: ChaosState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Record topic interaction (for diversity tracking)
   */
  recordTopic(topic: string): void {
    this.topicHistory.add(topic);
    
    // Limit history size
    if (this.topicHistory.size > 50) {
      const arr = Array.from(this.topicHistory);
      this.topicHistory = new Set(arr.slice(-25));
    }
  }

  /**
   * Clear topic history
   */
  clearTopicHistory(): void {
    this.topicHistory.clear();
  }

  /**
   * Adjust peer similarity based on chaos
   */
  private adjustSimilarity(peer: PeerMatch, chaosFactor: number): PeerMatch {
    // Add randomness to similarity score
    const noise = (Math.random() - 0.5) * chaosFactor * 0.4; // ±20% at max chaos
    const adjustedSimilarity = Math.max(0, Math.min(1, peer.similarity + noise));

    return {
      ...peer,
      similarity: adjustedSimilarity,
      _chaosAdjusted: true,
    };
  }

  /**
   * Boost peers with diverse topics
   */
  private boostTopicDiversity(peers: PeerMatch[], userTopics: string[], chaosFactor: number): PeerMatch[] {
    return peers.map(peer => {
      const peerTopics = peer.matchedTopics || [];
      const novelTopics = peerTopics.filter(t => !userTopics.includes(t) && !this.topicHistory.has(t));
      
      if (novelTopics.length > 0) {
        // Boost similarity for diverse peers
        const diversityBonus = (novelTopics.length / Math.max(1, userTopics.length)) * chaosFactor * 0.3;
        return {
          ...peer,
          similarity: Math.min(1, peer.similarity + diversityBonus),
          _diversityBonus: diversityBonus,
        };
      }
      
      return peer;
    });
  }

  /**
   * Inject randomness into peer list
   */
  private injectRandomness(peers: PeerMatch[], chaosFactor: number): PeerMatch[] {
    const randomChance = this.config.randomPeerChance * chaosFactor;
    
    // Don't actually inject synthetic peers here - just boost some existing low-similarity peers
    return peers.map(peer => {
      if (peer.similarity < 0.4 && Math.random() < randomChance) {
        return {
          ...peer,
          similarity: peer.similarity + 0.2, // Boost low-similarity peers
          _randomBoost: true,
        };
      }
      return peer;
    });
  }

  /**
   * Calculate chaos-adjusted score for sorting
   */
  private calculateChaosScore(peer: PeerMatch, chaosFactor: number): number {
    let score = peer.similarity;

    // At high chaos, diversity matters more than raw similarity
    if (chaosFactor > 0.5) {
      const diversityFactor = chaosFactor - 0.5;
      const hasNovelTopics = (peer.matchedTopics || []).some(
        t => !this.topicHistory.has(t)
      );
      if (hasNovelTopics) {
        score += diversityFactor * 0.3;
      }
    }

    return score;
  }

  /**
   * Load config from storage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      this.config = {
        ...this.config,
        ...parsed,
      };
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Save config to storage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify({
        chaosLevel: this.config.chaosLevel,
        enabled: this.config.enabled,
        topicDiversityBoost: this.config.topicDiversityBoost,
      }));
    } catch (err) {
      console.warn('[ChaosMode] Failed to save config:', err);
    }
  }

  private emitUpdate(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<ChaosModeConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveToStorage();
    this.emitUpdate();
    console.log('[ChaosMode] Config updated:', this.config);
  }
}

// Singleton instance
let _instance: ChaosModeService | null = null;

export function getChaosModeService(config?: Partial<ChaosModeConfig>): ChaosModeService {
  if (!_instance) {
    _instance = new ChaosModeService(config);
  }
  return _instance;
}
