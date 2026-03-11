/**
 * Time-Weighted Reputation Decay
 *
 * Implements exponential decay for reputation scores with configurable half-life.
 * Recent interactions contribute more to reputation than older ones.
 *
 * References: NEXT_STEPS.md#61-time-weighted-reputation-decay
 */

import { recordInteraction, getInteractionHistory } from '../social/graph.js';
import { dbGet, dbPut, dbFilter } from '../db/helpers.js';

const REPUTATION_STORE = 'reputation_scores';
const BOOTSTRAP_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SYBIL_CAP = 0.3;
const MUTUAL_FOLLOW_CAP = 0.4;

/**
 * Interaction with decay metadata
 */
export interface DecayInteraction {
  id: string;
  peerID: string;
  type: string;
  timestamp: number;
  baseWeight: number;
  decayedWeight: number;
  ageInDays: number;
}

/**
 * Reputation score with decay components
 */
export interface DecayReputation {
  peerID: string;
  rawScore: number;
  decayedScore: number;
  bootstrapBonus: number;
  sybilAdjustedScore: number;
  halfLifeDays: number;
  lastUpdated: number;
  interactionCount: number;
  decayCurve: DecayInteraction[];
}

/**
 * Decay configuration
 */
export interface DecayConfig {
  halfLifeDays: number;
  bootstrapPeriodDays: number;
  sybilCap: number;
  minInteractions: number;
}

const DEFAULT_CONFIG: DecayConfig = {
  halfLifeDays: 30,
  bootstrapPeriodDays: 7,
  sybilCap: SYBIL_CAP,
  minInteractions: 3,
};

/**
 * Calculate exponential decay factor based on age and half-life
 *
 * Formula: decay = 0.5 ^ (age / halfLife)
 *
 * @param ageInDays - Age of the interaction in days
 * @param halfLifeDays - Half-life period in days
 * @returns Decay factor between 0 and 1
 */
export function calculateDecayFactor(ageInDays: number, halfLifeDays: number): number {
  if (ageInDays <= 0) return 1.0;
  if (halfLifeDays <= 0) return 0.0;

  return Math.pow(0.5, ageInDays / halfLifeDays);
}

/**
 * Apply decay to an interaction based on its age
 *
 * @param timestamp - When the interaction occurred
 * @param baseWeight - Original weight of the interaction
 * @param halfLifeDays - Half-life period in days
 * @returns Object with decayed weight and age
 */
export function applyDecayToInteraction(
  timestamp: number,
  baseWeight: number,
  halfLifeDays: number = 30
): { decayedWeight: number; ageInDays: number; decayFactor: number } {
  const now = Date.now();
  const ageInMs = now - timestamp;
  const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

  const decayFactor = calculateDecayFactor(ageInDays, halfLifeDays);
  const decayedWeight = baseWeight * decayFactor;

  return { decayedWeight, ageInDays, decayFactor };
}

/**
 * Check if a peer is within the bootstrap period (new user)
 *
 * @param firstInteractionTimestamp - When the peer's first interaction occurred
 * @param bootstrapPeriodDays - Bootstrap period duration
 * @returns True if within bootstrap period
 */
export function isWithinBootstrapPeriod(
  firstInteractionTimestamp: number,
  bootstrapPeriodDays: number = 7
): boolean {
  const now = Date.now();
  const bootstrapPeriodMs = bootstrapPeriodDays * 24 * 60 * 60 * 1000;
  return now - firstInteractionTimestamp < bootstrapPeriodMs;
}

/**
 * Calculate bootstrap bonus for new users
 *
 * New users get a temporary reputation boost to help them establish presence.
 * The bonus decays linearly over the bootstrap period.
 *
 * @param firstInteractionTimestamp - When the peer's first interaction occurred
 * @param config - Decay configuration
 * @returns Bootstrap bonus between 0 and 0.2
 */
export function calculateBootstrapBonus(
  firstInteractionTimestamp: number,
  config: DecayConfig = DEFAULT_CONFIG
): number {
  const now = Date.now();
  const bootstrapPeriodMs = config.bootstrapPeriodDays * 24 * 60 * 60 * 1000;
  const age = now - firstInteractionTimestamp;

  if (age >= bootstrapPeriodMs) {
    return 0;
  }

  // Linear decay from 0.2 to 0 over bootstrap period
  const remainingRatio = 1 - age / bootstrapPeriodMs;
  return 0.2 * remainingRatio;
}

/**
 * Apply Sybil resistance cap to reputation score
 *
 * Limits the impact of potential Sybil attacks by capping
 * certain reputation components.
 *
 * @param rawScore - Raw reputation score
 * @param mutualFollowCount - Number of mutual follows
 * @param config - Decay configuration
 * @returns Sybil-adjusted score
 */
export function applySybilResistance(
  rawScore: number,
  mutualFollowCount: number,
  config: DecayConfig = DEFAULT_CONFIG
): number {
  // Cap mutual follow contribution
  const mutualFollowBonus = Math.min(
    mutualFollowCount * 0.05,
    MUTUAL_FOLLOW_CAP
  );

  // Apply Sybil cap to prevent runaway reputation
  const sybilLimitedScore = Math.min(rawScore, config.sybilCap + mutualFollowBonus);

  return sybilLimitedScore;
}

/**
 * Compute time-weighted reputation with decay
 *
 * @param peerID - Peer to compute reputation for
 * @param config - Optional decay configuration
 * @returns Computed reputation with decay components
 */
export async function computeDecayedReputation(
  peerID: string,
  config: DecayConfig = DEFAULT_CONFIG
): Promise<DecayReputation> {
  const interactions = await getInteractionHistory(peerID);

  if (interactions.length === 0) {
    return {
      peerID,
      rawScore: 0,
      decayedScore: 0,
      bootstrapBonus: 0,
      sybilAdjustedScore: 0,
      halfLifeDays: config.halfLifeDays,
      lastUpdated: Date.now(),
      interactionCount: 0,
      decayCurve: [],
    };
  }

  // Find first interaction for bootstrap calculation
  const firstInteraction = interactions.reduce(
    (min, i) => (i.timestamp < min.timestamp ? i : min),
    interactions[0]
  );

  // Apply decay to all interactions
  const decayCurve: DecayInteraction[] = interactions.map((interaction) => {
    const { decayedWeight, ageInDays } = applyDecayToInteraction(
      interaction.timestamp,
      interaction.weight,
      config.halfLifeDays
    );

    return {
      id: `decay_${crypto.randomUUID()}`,
      peerID: interaction.peerID,
      type: interaction.type,
      timestamp: interaction.timestamp,
      baseWeight: interaction.weight,
      decayedWeight,
      ageInDays,
    };
  });

  // Calculate raw and decayed scores
  const rawScore = interactions.reduce((sum, i) => sum + i.weight, 0);
  const decayedScore = decayCurve.reduce((sum, i) => sum + i.decayedWeight, 0);

  // Calculate bootstrap bonus for new users
  const bootstrapBonus = calculateBootstrapBonus(firstInteraction.timestamp, config);

  // Apply Sybil resistance
  const mutualFollowCount = 0; // Would be computed from social graph
  const sybilAdjustedScore = applySybilResistance(decayedScore, mutualFollowCount, config);

  // Add bootstrap bonus (capped at 0.5 total)
  const finalScore = Math.min(sybilAdjustedScore + bootstrapBonus, 0.5);

  return {
    peerID,
    rawScore,
    decayedScore,
    bootstrapBonus,
    sybilAdjustedScore: finalScore,
    halfLifeDays: config.halfLifeDays,
    lastUpdated: Date.now(),
    interactionCount: interactions.length,
    decayCurve,
  };
}

/**
 * Get reputation decay curve for visualization
 *
 * @param peerID - Peer to get decay curve for
 * @param daysToProject - Number of days to project into the future
 * @param config - Decay configuration
 * @returns Array of reputation values over time
 */
export async function getReputationDecayCurve(
  peerID: string,
  daysToProject: number = 30,
  config: DecayConfig = DEFAULT_CONFIG
): Promise<{ day: number; score: number; rawScore: number }[]> {
  const reputation = await computeDecayedReputation(peerID, config);
  const curve: { day: number; score: number; rawScore: number }[] = [];

  const currentScore = reputation.decayedScore;
  const halfLifeDays = config.halfLifeDays;

  for (let day = 0; day <= daysToProject; day++) {
    // Project future decay assuming no new interactions
    const projectedScore = currentScore * calculateDecayFactor(day, halfLifeDays);

    curve.push({
      day,
      score: Math.max(projectedScore, 0),
      rawScore: reputation.rawScore,
    });
  }

  return curve;
}

/**
 * Calculate interaction weight based on type
 *
 * Different interaction types have different weights:
 * - follow: 5 (strong signal)
 * - repost: 3 (medium signal)
 * - reply: 2 (engagement signal)
 * - quote: 2 (engagement signal)
 * - like: 1 (weak signal)
 *
 * @param type - Interaction type
 * @returns Weight value
 */
export function getInteractionWeight(type: string): number {
  const weights: Record<string, number> = {
    follow: 5,
    repost: 3,
    reply: 2,
    quote: 2,
    like: 1,
  };

  return weights[type] ?? 1;
}

/**
 * Record a weighted interaction with decay tracking
 *
 * @param peerID - Peer to record interaction with
 * @param type - Type of interaction
 * @param customWeight - Optional custom weight (uses default if not provided)
 */
export async function recordWeightedInteraction(
  peerID: string,
  type: string,
  customWeight?: number
): Promise<void> {
  const weight = customWeight ?? getInteractionWeight(type);
  await recordInteraction(peerID, type, weight);
}

/**
 * Get effective reputation for Sybil resistance validation
 *
 * Returns the reputation score after all adjustments,
 * suitable for access control decisions.
 *
 * @param peerID - Peer to get effective reputation for
 * @param config - Optional decay configuration
 * @returns Effective reputation score (0-1)
 */
export async function getEffectiveReputation(
  peerID: string,
  config: DecayConfig = DEFAULT_CONFIG
): Promise<number> {
  const reputation = await computeDecayedReputation(peerID, config);
  return reputation.sybilAdjustedScore;
}

/**
 * Check if a peer meets minimum reputation threshold
 *
 * @param peerID - Peer to check
 * @param threshold - Minimum reputation required
 * @param config - Optional decay configuration
 * @returns True if peer meets threshold
 */
export async function meetsReputationThreshold(
  peerID: string,
  threshold: number,
  config: DecayConfig = DEFAULT_CONFIG
): Promise<boolean> {
  const reputation = await getEffectiveReputation(peerID, config);
  return reputation >= threshold;
}

/**
 * Cache reputation score for performance
 */
export async function cacheReputationScore(
  peerID: string,
  reputation: DecayReputation
): Promise<void> {
  await dbPut(REPUTATION_STORE, {
    ...reputation,
    cachedAt: Date.now(),
  });
}

/**
 * Get cached reputation score
 */
export async function getCachedReputationScore(
  peerID: string
): Promise<DecayReputation | null> {
  const cached = await dbGet<DecayReputation & { cachedAt: number }>(
    REPUTATION_STORE,
    peerID
  );

  if (!cached) return null;

  // Cache expires after 1 hour
  const cacheAge = Date.now() - cached.cachedAt;
  const cacheExpiry = 60 * 60 * 1000; // 1 hour

  if (cacheAge > cacheExpiry) {
    return null;
  }

  const { cachedAt, ...reputation } = cached;
  return reputation;
}

/**
 * Compute reputation with caching
 *
 * @param peerID - Peer to compute reputation for
 * @param config - Optional decay configuration
 * @param forceRefresh - Force recomputation even if cached
 * @returns Computed reputation
 */
export async function computeReputationCached(
  peerID: string,
  config: DecayConfig = DEFAULT_CONFIG,
  forceRefresh: boolean = false
): Promise<DecayReputation> {
  if (!forceRefresh) {
    const cached = await getCachedReputationScore(peerID);
    if (cached) return cached;
  }

  const reputation = await computeDecayedReputation(peerID, config);
  await cacheReputationScore(peerID, reputation);

  return reputation;
}

/**
 * Get reputation half-life in days
 *
 * @param config - Decay configuration
 * @returns Half-life in days
 */
export function getHalfLifeDays(config: DecayConfig = DEFAULT_CONFIG): number {
  return config.halfLifeDays;
}

/**
 * Calculate time until reputation reaches a target score
 *
 * @param currentScore - Current reputation score
 * @param targetScore - Target reputation score
 * @param halfLifeDays - Half-life period in days
 * @returns Days until target score is reached (negative if already exceeded)
 */
export function timeToReachScore(
  currentScore: number,
  targetScore: number,
  halfLifeDays: number = 30
): number {
  if (currentScore <= targetScore) {
    return 0;
  }

  // Solve: targetScore = currentScore * 0.5^(days/halfLife)
  // days = halfLife * log2(currentScore/targetScore)
  const ratio = currentScore / targetScore;
  const days = halfLifeDays * Math.log2(ratio);

  return Math.max(0, days);
}
