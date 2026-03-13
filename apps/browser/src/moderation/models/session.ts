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
