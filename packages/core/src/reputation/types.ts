/**
 * Reputation System Type Definitions
 */

/**
 * Interaction between peers
 */
export interface Interaction {
  type: 'chat' | 'post' | 'follow' | 'tip' | 'court' | 'delegation';
  peerID: string;
  timestamp: number;
  weight: number;
  signed: boolean;
}

/**
 * Reputation computation result
 */
export interface ReputationResult {
  peerID: string;
  rawScore: number;           // 0-100, before decay
  decayedScore: number;       // After time-decay
  halfLifeDays: number;       // Configurable half-life
  mutualFollows: number;      // Bidirectional follows
  interactionCount: number;   // Total interactions
  recentInteractions: number; // Last 30 days
  bootstrapBonus: number;     // New peer bonus (0-1.0)
  sybilResistance: number;    // 0-1, higher = more resistant
}

/**
 * Trust path in Web of Trust
 */
export interface TrustPath {
  source: string;
  target: string;
  hops: string[];             // Intermediate peers
  depth: number;              // Number of hops
  confidence: number;         // 0-1, path confidence
  minTrust: number;           // Minimum trust along path
}

/**
 * Composite trust score
 */
export interface TrustScore {
  directTrust: number;        // Direct interaction history
  indirectTrust: number;      // Via Web of Trust
  mutualFollowBonus: number;  // Bonus for mutual follows
  stakeBonus: number;         // Bonus for staked peers (Phase 2.2)
  sybilCap: number;           // Maximum trust for new peers
  total: number;              // Weighted sum
}

/**
 * Reputation event for DHT announcement
 */
export interface ReputationEvent {
  type: 'interaction' | 'court_verdict' | 'stake_change';
  actor: string;
  target: string;
  delta: number;
  timestamp: number;
  signature: Uint8Array;
  ttl: number;
}

/**
 * Web of Trust query result
 */
export interface WoTQueryResult {
  targetPeer: string;
  trustScore: number;
  paths: TrustPath[];
  directInteractions: number;
  indirectInteractions: number;
  confidence: number;
}

/**
 * Guardian for social recovery (Phase 2.6)
 */
export interface Guardian {
  peerID: string;
  addedAt: number;
  trustThreshold: number;     // Minimum trust to be guardian
  isActive: boolean;
}

/**
 * Court case for moderation (Phase 2.3)
 */
export interface CourtCase {
  caseID: string;
  reporter: string;
  reported: string;
  reason: 'spam' | 'harassment' | 'sybil' | 'fraud' | 'other';
  evidence: string[];
  jury: string[];             // Selected jurors
  verdict?: 'guilty' | 'not_guilty' | 'inconclusive';
  votes: Record<string, 'guilty' | 'not_guilty'>;
  createdAt: number;
  resolvedAt?: number;
}

/**
 * Stake bond for Sybil resistance (Phase 2.2)
 */
export interface StakeBond {
  peerID: string;
  amount: number;             // In satoshis
  lockedAt: number;
  unlockableAt: number;
  slashedAmount: number;
  reason?: string;
}
