/* eslint-disable */
/**
 * Moderation System Types
 *
 * Types for the decentralized community courts system:
 * appeals, juries, verdicts, and court sessions.
 */

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

export interface JuryVote {
  jurorId: string;
  decision: 'uphold' | 'overturn' | 'abstain';
  reasoning: string;
  timestamp: number;
  reputationWeight: number;
  signature?: Uint8Array;
}

export interface Jury {
  id: string;
  appealId: string;
  councilId: string;
  jurors: string[];
  selectedAt: number;
  expiresAt: number;
  votes: JuryVote[];
  verdict: Verdict | null;
  status: 'active' | 'concluded';
}

export interface CourtSession {
  id: string;
  councilId: string;
  activeAppeals: string[];
  completedAppeals: string[];
  startedAt: number;
  endedAt?: number;
}

export interface JurorStats {
  peerID: string;
  casesServed: number;
  votesCast: number;
  majorityAlignment: number;
  averageResponseTime: number;
  reputationScore: number;
}

export interface CourtStats {
  totalAppeals: number;
  pendingAppeals: number;
  completedAppeals: number;
  averageResolutionTime: number;
  overturnRate: number;
}

/** Minimal council shape needed by the jury service */
export interface Council {
  id: string;
  members: string[];
  reputationThreshold: number;
}
