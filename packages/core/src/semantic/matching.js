import { cosineSimilarity } from '../math/cosine.js';
import { locationOverlap, timeOverlap } from './spatiotemporal.js';
const DEFAULT_CONFIG = {
    rootWeight: 1.0,
    fusedWeight: 0.8,
    tagMatchBonus: 1.2,
    minSimilarity: 0.55,
};
/**
 * Parses a relation object string into structured data.
 *
 * @param object - Relation object string (e.g., "lat:35.6895, long:139.6917, radius:50km")
 * @returns Parsed location, time window, or null
 */
function parseRelationObject(object) {
    // Try parsing as location
    const locationMatch = object.match(/lat:([-\d.]+),\s*long:([-\d.]+)(?:,\s*radius:(\d+)km)?/i);
    if (locationMatch) {
        return {
            lat: parseFloat(locationMatch[1]),
            lon: parseFloat(locationMatch[2]),
            radius: locationMatch[3] ? parseInt(locationMatch[3], 10) : undefined,
        };
    }
    // Try parsing as time window
    const timeMatch = object.match(/start:([^,]+),\s*end:([^,]+)/i);
    if (timeMatch) {
        const start = new Date(timeMatch[1].trim()).getTime();
        const end = new Date(timeMatch[2].trim()).getTime();
        if (!isNaN(start) && !isNaN(end)) {
            return { start, end };
        }
    }
    return null;
}
/**
 * Computes spatiotemporal bonus between two relations.
 *
 * @param relA - First relation
 * @param relB - Second relation
 * @returns Spatiotemporal bonus factor (1.0 = no bonus, >1.0 = bonus)
 */
function spatiotemporalBonus(relA, relB) {
    if (!relA.object || !relB.object) {
        return 1.0;
    }
    const objA = parseRelationObject(relA.object);
    const objB = parseRelationObject(relB.object);
    if (!objA || !objB) {
        return 1.0;
    }
    // Both are locations
    if ('lat' in objA && 'lat' in objB) {
        const overlap = locationOverlap(objA, objB);
        return 1.0 + overlap * 0.5; // Up to 1.5x bonus
    }
    // Both are time windows
    if ('start' in objA && 'start' in objB) {
        const overlap = timeOverlap(objA, objB);
        return 1.0 + overlap * 0.5; // Up to 1.5x bonus
    }
    return 1.0;
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
export function relationalMatch(myDists, peerDists, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    // Handle empty distributions
    if (myDists.length === 0 || peerDists.length === 0) {
        return 0;
    }
    // Find root distributions
    const myRoot = myDists.find((d) => d.tag === 'root');
    const peerRoot = peerDists.find((d) => d.tag === 'root');
    let score = 0;
    let totalWeight = 0;
    // Root alignment (weighted)
    if (myRoot && peerRoot) {
        const rootSim = cosineSimilarity(myRoot.mu, peerRoot.mu);
        const weightedSim = rootSim * cfg.rootWeight * (myRoot.weight ?? 1) * (peerRoot.weight ?? 1);
        score += weightedSim;
        totalWeight += cfg.rootWeight;
    }
    // Fused distribution alignment (bipartite best-match)
    const myFused = myDists.filter((d) => d.tag !== 'root');
    const peerFused = peerDists.filter((d) => d.tag !== 'root');
    if (myFused.length > 0 && peerFused.length > 0) {
        // Create similarity matrix
        const usedPeer = new Set();
        let fusedScore = 0;
        let fusedWeight = 0;
        for (const myDist of myFused) {
            let bestSim = 0;
            let bestPeerIdx = -1;
            let bestBonus = 1.0;
            for (let j = 0; j < peerFused.length; j++) {
                if (usedPeer.has(j))
                    continue;
                const peerDist = peerFused[j];
                const sim = cosineSimilarity(myDist.mu, peerDist.mu);
                // Tag match bonus
                let bonus = 1.0;
                if (myDist.tag && peerDist.tag && myDist.tag === peerDist.tag) {
                    bonus = cfg.tagMatchBonus;
                }
                // Spatiotemporal bonus
                const myRel = { tag: myDist.tag || '', object: undefined, weight: myDist.weight };
                const peerRel = {
                    tag: peerDist.tag || '',
                    object: undefined,
                    weight: peerDist.weight,
                };
                const stBonus = spatiotemporalBonus(myRel, peerRel);
                bonus *= stBonus;
                const weightedSim = sim * bonus;
                if (weightedSim > bestSim) {
                    bestSim = weightedSim;
                    bestPeerIdx = j;
                    bestBonus = bonus;
                }
            }
            if (bestPeerIdx >= 0) {
                usedPeer.add(bestPeerIdx);
                fusedScore += bestSim;
                fusedWeight += cfg.fusedWeight * bestBonus;
            }
        }
        if (fusedWeight > 0) {
            score += fusedScore;
            totalWeight += fusedWeight;
        }
    }
    // Normalize to [0, 1]
    if (totalWeight === 0) {
        return 0;
    }
    const normalizedScore = score / totalWeight;
    // Filter by minimum similarity
    if (normalizedScore < cfg.minSimilarity) {
        return 0;
    }
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, normalizedScore));
}
/**
 * Computes simple cosine similarity between distribution means.
 *
 * @param a - First distribution
 * @param b - Second distribution
 * @returns Cosine similarity in [-1, 1]
 */
export function distributionSimilarity(a, b) {
    return cosineSimilarity(a.mu, b.mu);
}
/**
 * Ranks peer distributions against my distributions.
 *
 * @param myDists - My distributions
 * @param candidates - Array of peer distribution sets
 * @param config - Optional matching configuration
 * @returns Sorted array of { peerIndex, score } pairs (descending by score)
 */
export function rankCandidates(myDists, candidates, config = {}) {
    const scores = candidates.map((peerDists, idx) => ({
        peerIndex: idx,
        score: relationalMatch(myDists, peerDists, config),
    }));
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    return scores;
}
//# sourceMappingURL=matching.js.map