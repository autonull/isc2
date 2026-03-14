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
  verdict: any; // We'll use any here or the verdict type from appeal
  status: 'active' | 'concluded';
}
