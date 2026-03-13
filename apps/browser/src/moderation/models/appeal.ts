export interface AppealCase {
  id: string;
  reportId: string;
  appellant: string;
  reason: string;
  evidence: string[];
  timestamp: number;
  status: 'pending' | 'decided';
  signature: Uint8Array;
}

export interface Verdict {
  appealId: string;
  decision: 'uphold' | 'overturn' | 'abstain';
  voteBreakdown: { uphold: number; overturn: number; abstain: number };
  reputationWeightedScore: number;
  reasoning: string;
  decidedAt: number;
  enforced: boolean;
}
