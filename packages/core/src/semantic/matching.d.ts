import { Distribution } from '../types.js';
/**
 * Relational matching configuration.
 */
export interface MatchConfig {
    rootWeight: number;
    fusedWeight: number;
    tagMatchBonus: number;
    minSimilarity: number;
}
/**
 * Computes relational match score between two sets of distributions.
 *
 * Uses bipartite best-match alignment across root and fused distributions,
 * with bonuses for tag matching and spatiotemporal overlap.
 *
 * @param myDists - My channel distributions (root + fused)
 * @param peerDists - Peer channel distributions (root + fused)
 * @param config - Optional matching configuration
 * @returns Match score in [0, 1], filtered to 0 if below minSimilarity
 *
 * @example
 * ```typescript
 * const myDists = [
 *   { mu: [...], sigma: 0.1, tag: 'root', weight: 1.0 },
 *   { mu: [...], sigma: 0.15, tag: 'in_location', weight: 1.2 }
 * ];
 * const peerDists = [
 *   { mu: [...], sigma: 0.1, tag: 'root', weight: 1.0 },
 *   { mu: [...], sigma: 0.12, tag: 'in_location', weight: 1.2 }
 * ];
 * const score = relationalMatch(myDists, peerDists);
 * ```
 */
export declare function relationalMatch(myDists: Distribution[], peerDists: Distribution[], config?: Partial<MatchConfig>): number;
/**
 * Computes simple cosine similarity between distribution means.
 *
 * @param a - First distribution
 * @param b - Second distribution
 * @returns Cosine similarity in [-1, 1]
 */
export declare function distributionSimilarity(a: Distribution, b: Distribution): number;
/**
 * Ranks peer distributions against my distributions.
 *
 * @param myDists - My distributions
 * @param candidates - Array of peer distribution sets
 * @param config - Optional matching configuration
 * @returns Sorted array of { peerIndex, score } pairs (descending by score)
 */
export declare function rankCandidates(myDists: Distribution[], candidates: Distribution[][], config?: Partial<MatchConfig>): Array<{
    peerIndex: number;
    score: number;
}>;
//# sourceMappingURL=matching.d.ts.map