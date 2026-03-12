/**
 * Web of Trust (WoT) Implementation
 * 
 * Computes trust propagation through social graph.
 * Used for reputation-weighted discovery and moderation.
 */

import type { TrustPath, WoTQueryResult } from './types.js';

/**
 * Minimum trust threshold for path inclusion
 */
const MIN_TRUST_THRESHOLD = 0.3;

/**
 * Maximum path depth to explore
 */
const MAX_PATH_DEPTH = 4;

/**
 * Confidence decay per hop
 */
const CONFIDENCE_DECAY = 0.7;

/**
 * Find all trust paths between source and target peers
 * 
 * Uses modified BFS with trust-weighted pruning
 * 
 * @param source - Source peer ID
 * @param target - Target peer ID
 * @param follows - Map of peer -> set of peers they follow
 * @param trustScores - Map of peer -> direct trust score (0-1)
 * @param maxDepth - Maximum path depth (default: 4)
 * @returns Array of trust paths
 */
export function findTrustPaths(
  source: string,
  target: string,
  follows: Map<string, Set<string>>,
  trustScores: Map<string, number>,
  maxDepth: number = MAX_PATH_DEPTH
): TrustPath[] {
  // Edge case: same peer
  if (source === target) {
    return [
      {
        source,
        target,
        hops: [],
        depth: 0,
        confidence: 1.0,
        minTrust: 1.0,
      },
    ];
  }

  const paths: TrustPath[] = [];
  const queue: Array<{
    peer: string;
    path: string[];
    minTrust: number;
    depth: number;
  }> = [{ peer: source, path: [], minTrust: 1.0, depth: 0 }];
  
  const visited = new Map<string, number>(); // peer -> best confidence seen

  while (queue.length > 0) {
    const { peer, path, minTrust, depth } = queue.shift()!;

    // Skip if we've seen this peer with better confidence
    const existingConfidence = visited.get(peer) || 0;
    const currentConfidence = minTrust * Math.pow(CONFIDENCE_DECAY, depth);
    
    if (existingConfidence >= currentConfidence) {
      continue;
    }
    visited.set(peer, currentConfidence);

    // Skip if max depth reached
    if (depth >= maxDepth) {
      continue;
    }

    // Skip if trust falls below threshold
    if (minTrust < MIN_TRUST_THRESHOLD) {
      continue;
    }

    // Get peers that this peer follows (trusts)
    const following = follows.get(peer) || new Set();

    for (const nextPeer of following) {
      // Get direct trust score for next peer
      const nextTrust = trustScores.get(nextPeer) || 0.5;
      const newMinTrust = Math.min(minTrust, nextTrust);
      const newPath = [...path, peer];
      const newDepth = depth + 1;
      const pathConfidence = newMinTrust * Math.pow(CONFIDENCE_DECAY, newDepth);

      if (nextPeer === target) {
        // Found a path to target
        paths.push({
          source,
          target,
          hops: newPath,
          depth: newDepth,
          confidence: pathConfidence,
          minTrust: newMinTrust,
        });
      } else if (!visited.has(nextPeer) ||
                 visited.get(nextPeer)! < pathConfidence * CONFIDENCE_DECAY) {
        // Continue exploring
        queue.push({
          peer: nextPeer,
          path: newPath,
          minTrust: newMinTrust,
          depth: newDepth,
        });
      }
    }
  }

  // Sort by confidence (highest first)
  paths.sort((a, b) => b.confidence - a.confidence);

  return paths;
}

/**
 * Compute Web of Trust score for a target peer
 * 
 * Combines direct trust with indirect trust via paths
 * 
 * @param source - Source peer ID (evaluator)
 * @param target - Target peer ID (being evaluated)
 * @param follows - Map of peer -> set of peers they follow
 * @param trustScores - Map of peer -> direct trust score
 * @param directWeight - Weight for direct trust (default: 0.7)
 * @returns WoT score (0-1)
 */
export function computeWoTScore(
  source: string,
  target: string,
  follows: Map<string, Set<string>>,
  trustScores: Map<string, number>,
  directWeight: number = 0.7
): number {
  // Get direct trust score
  const directTrust = trustScores.get(target) || 0;

  // Find trust paths
  const paths = findTrustPaths(source, target, follows, trustScores);

  if (paths.length === 0) {
    return directTrust * directWeight;
  }

  // Compute indirect trust from paths
  // Weight by confidence and inverse depth
  const indirectTrust = paths.reduce((sum, path) => {
    const depthWeight = 1 / path.depth;
    return sum + path.confidence * depthWeight;
  }, 0) / paths.length;

  // Combine direct and indirect trust
  const combined = directTrust * directWeight + indirectTrust * (1 - directWeight);

  return Math.min(1, combined);
}

/**
 * Query Web of Trust for a target peer
 * 
 * Returns comprehensive trust information
 * 
 * @param source - Source peer ID
 * @param target - Target peer ID
 * @param follows - Map of peer -> set of peers they follow
 * @param trustScores - Map of peer -> direct trust score
 * @returns WoT query result
 */
export function queryWoT(
  source: string,
  target: string,
  follows: Map<string, Set<string>>,
  trustScores: Map<string, number>
): WoTQueryResult {
  const paths = findTrustPaths(source, target, follows, trustScores);
  const directTrust = trustScores.get(target) || 0;
  const wotScore = computeWoTScore(source, target, follows, trustScores);

  // Count direct and indirect interactions
  const directInteractions = directTrust > 0 ? 1 : 0;
  const indirectInteractions = paths.length;

  // Compute overall confidence
  const confidence = paths.length > 0
    ? paths.reduce((sum, p) => sum + p.confidence, 0) / paths.length
    : directTrust > 0 ? 0.8 : 0.2;

  return {
    targetPeer: target,
    trustScore: wotScore,
    paths,
    directInteractions,
    indirectInteractions,
    confidence,
  };
}

/**
 * Find trusted introducers between source and target
 * 
 * Introducers are peers that both source and target trust
 * 
 * @param source - Source peer ID
 * @param target - Target peer ID
 * @param follows - Map of peer -> set of peers they follow
 * @param trustScores - Map of peer -> direct trust score
 * @param minTrust - Minimum trust threshold (default: 0.5)
 * @returns Array of introducer peer IDs
 */
export function findTrustedIntroducers(
  source: string,
  target: string,
  follows: Map<string, Set<string>>,
  trustScores: Map<string, number>,
  minTrust: number = 0.5
): string[] {
  const sourceFollows = follows.get(source) || new Set();
  const targetFollows = follows.get(target) || new Set();

  // Find common connections
  const common = new Set<string>();
  for (const peer of sourceFollows) {
    if (targetFollows.has(peer)) {
      common.add(peer);
    }
  }

  // Filter by trust threshold
  const introducers: string[] = [];
  for (const peer of common) {
    const trust = trustScores.get(peer) || 0;
    if (trust >= minTrust) {
      introducers.push(peer);
    }
  }

  // Sort by trust score
  introducers.sort((a, b) => (trustScores.get(b) || 0) - (trustScores.get(a) || 0));

  return introducers;
}

/**
 * Compute trust cluster for a peer
 * 
 * Finds all peers within trust distance
 * 
 * @param source - Source peer ID
 * @param follows - Map of peer -> set of peers they follow
 * @param trustScores - Map of peer -> direct trust score
 * @param maxDistance - Maximum trust distance (default: 3)
 * @param minTrust - Minimum trust threshold (default: 0.4)
 * @returns Set of peer IDs in trust cluster
 */
export function computeTrustCluster(
  source: string,
  follows: Map<string, Set<string>>,
  trustScores: Map<string, number>,
  maxDistance: number = 3,
  minTrust: number = 0.4
): Set<string> {
  const cluster = new Set<string>([source]);
  const queue: Array<{ peer: string; distance: number; minTrust: number }> = [
    { peer: source, distance: 0, minTrust: 1.0 },
  ];

  while (queue.length > 0) {
    const { peer, distance, minTrust: pathMinTrust } = queue.shift()!;

    if (distance >= maxDistance) {
      continue;
    }

    const following = follows.get(peer) || new Set();

    for (const nextPeer of following) {
      if (cluster.has(nextPeer)) {
        continue;
      }

      const nextTrust = trustScores.get(nextPeer) || 0;
      const newMinTrust = Math.min(pathMinTrust, nextTrust);

      if (newMinTrust >= minTrust) {
        cluster.add(nextPeer);
        queue.push({
          peer: nextPeer,
          distance: distance + 1,
          minTrust: newMinTrust,
        });
      }
    }
  }

  return cluster;
}

/**
 * Suggest peers to trust based on WoT
 * 
 * @param source - Source peer ID
 * @param follows - Map of peer -> set of peers they follow
 * @param trustScores - Map of peer -> direct trust score
 * @param limit - Maximum suggestions (default: 10)
 * @returns Array of { peerID, score, reason }
 */
export function suggestPeersToTrust(
  source: string,
  follows: Map<string, Set<string>>,
  trustScores: Map<string, number>,
  limit: number = 10
): Array<{ peerID: string; score: number; reason: string }> {
  const sourceFollows = follows.get(source) || new Set();
  const suggestions = new Map<string, { score: number; introducers: number }>();

  // Find peers trusted by people source trusts
  for (const trustedPeer of sourceFollows) {
    const trustedPeerFollows = follows.get(trustedPeer) || new Set();
    const trustScore = trustScores.get(trustedPeer) || 0.5;

    for (const candidate of trustedPeerFollows) {
      // Skip if already trusted or is source
      if (candidate === source || sourceFollows.has(candidate)) {
        continue;
      }

      // Skip if already suggested
      if (!suggestions.has(candidate)) {
        suggestions.set(candidate, { score: 0, introducers: 0 });
      }

      const existing = suggestions.get(candidate)!;
      existing.score += trustScore * 0.5;
      existing.introducers += 1;
    }
  }

  // Convert to array and sort
  const result = Array.from(suggestions.entries())
    .map(([peerID, data]) => ({
      peerID,
      score: data.score,
      reason: `Trusted by ${data.introducers} of your connections`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return result;
}
