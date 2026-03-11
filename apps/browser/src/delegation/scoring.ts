import type { DelegateCapability, DelegationHealth } from '@isc/protocol/src/messages.js';

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
  const uptimeWeight = 0.4;
  const successRateWeight = 0.3;
  const throughputWeight = 0.2;
  const rateLimitWeight = 0.1;

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
  const scored: ScoredSupernode[] = capabilities.map((cap) => {
    const health = healthMap.get(cap.peerID);
    const stats = statsMap.get(cap.peerID) || {
      successRate: health?.successRate ?? 0.5,
      avgLatencyMs: health?.avgLatencyMs ?? 1000,
      requestsServed24h: health?.requestsServed24h ?? 0,
    };

    const score = scoreSupernode(cap, stats);

    return { capability: cap, score, stats };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export function filterHealthySupernodes(
  scored: ScoredSupernode[],
  minSuccessRate: number = 0.85
): ScoredSupernode[] {
  return scored.filter((s) => s.stats.successRate >= minSuccessRate);
}

export function selectTopSupernodes(
  scored: ScoredSupernode[],
  count: number = 3
): ScoredSupernode[] {
  return scored.slice(0, count);
}
