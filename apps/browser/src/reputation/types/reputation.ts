/* eslint-disable */
/**
 * Reputation Type Definitions
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

export interface DecayConfig {
  halfLifeDays: number;
  bootstrapPeriodDays: number;
  sybilCap: number;
  minInteractions: number;
}

export interface InteractionWeightConfig {
  follow: number;
  repost: number;
  reply: number;
  quote: number;
  like: number;
}

export interface DecayCurvePoint {
  day: number;
  score: number;
  rawScore: number;
}
