import type { DelegateCapability, DelegationHealth } from '@isc/protocol/messages';
import { Config } from '@isc/core';

export interface SupernodeStats {
  successRate: number;
  avgLatencyMs: number;
  requestsServed24h: number;
}

export interface ScoredSupernode {
  capability: DelegateCapability;
  score: number;
  stats: SupernodeStats;
}

export function scoreSupernode(cap: DelegateCapability, stats: SupernodeStats): number {
  const { uptimeWeight, successRateWeight, throughputWeight, rateLimitWeight } = Config.scoring;

  const uptimeScore = cap.uptime;
  const successRateScore = stats.successRate;
  const throughputScore = Math.min(stats.requestsServed24h / 1000, 1);
  const rateLimitScore = 1 - cap.rateLimit.requestsPerMinute / 30;

  return (
    uptimeScore * uptimeWeight +
    successRateScore * successRateWeight +
    throughputScore * throughputWeight +
    rateLimitScore * rateLimitWeight
  );
}

export function rankSupernodes(
  capabilities: DelegateCapability[],
  healthMap: Map<string, DelegationHealth>,
  statsMap: Map<string, SupernodeStats>
): ScoredSupernode[] {
  const scored = capabilities.map((cap) => {
    const health = healthMap.get(cap.peerID);
    const stats = statsMap.get(cap.peerID) ?? {
      successRate: health?.successRate ?? 0.5,
      avgLatencyMs: health?.avgLatencyMs ?? 1000,
      requestsServed24h: health?.requestsServed24h ?? 0,
    };

    return { capability: cap, score: scoreSupernode(cap, stats), stats };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export function filterHealthySupernodes(
  scored: ScoredSupernode[],
  minSuccessRate: number = Config.scoring.minSuccessRate
): ScoredSupernode[] {
  return scored.filter((s) => s.stats.successRate >= minSuccessRate);
}

export function selectTopSupernodes(
  scored: ScoredSupernode[],
  count: number = Config.scoring.topSupernodesCount
): ScoredSupernode[] {
  return scored.slice(0, count);
}
