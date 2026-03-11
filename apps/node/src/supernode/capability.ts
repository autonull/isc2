import type { DelegateCapability } from '@isc/protocol';

export interface SupernodeStats {
  successRate: number;
  avgLatencyMs: number;
  requestsServed24h: number;
}

export function validateDelegateCapability(cap: DelegateCapability): boolean {
  if (cap.type !== 'delegate_capability') return false;
  if (!cap.peerID || typeof cap.peerID !== 'string') return false;
  if (!Array.isArray(cap.services) || cap.services.length === 0) return false;
  const validServices = ['embed', 'ann_query', 'sig_verify'];
  if (!cap.services.every((s) => validServices.includes(s))) return false;
  if (!cap.rateLimit || cap.rateLimit.requestsPerMinute <= 0 || cap.rateLimit.maxConcurrent <= 0)
    return false;
  if (!cap.model || typeof cap.model !== 'string') return false;
  if (cap.uptime < 0 || cap.uptime > 1) return false;
  if (!cap.signature || !(cap.signature instanceof Uint8Array)) return false;
  return true;
}

export function createDelegateCapability(
  peerID: string,
  services: ('embed' | 'ann_query' | 'sig_verify')[],
  rateLimit: { requestsPerMinute: number; maxConcurrent: number },
  model: string,
  uptime: number,
  signature: Uint8Array
): DelegateCapability {
  return {
    type: 'delegate_capability',
    peerID,
    services,
    rateLimit,
    model,
    uptime,
    signature,
  };
}

export function scoreSupernode(cap: DelegateCapability, stats: SupernodeStats): number {
  return (
    cap.uptime * 0.4 +
    stats.successRate * 0.3 +
    (stats.requestsServed24h / 1000) * 0.2 +
    (1 - cap.rateLimit.requestsPerMinute / 30) * 0.1
  );
}

export function rankSupernodes(
  capabilities: DelegateCapability[],
  statsMap: Map<string, SupernodeStats>
): DelegateCapability[] {
  return [...capabilities].sort((a, b) => {
    const statsA = statsMap.get(a.peerID) || {
      successRate: 0.5,
      avgLatencyMs: 1000,
      requestsServed24h: 0,
    };
    const statsB = statsMap.get(b.peerID) || {
      successRate: 0.5,
      avgLatencyMs: 1000,
      requestsServed24h: 0,
    };
    return scoreSupernode(b, statsB) - scoreSupernode(a, statsA);
  });
}
