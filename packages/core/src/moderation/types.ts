/**
 * Moderation System Type Definitions
 */

/**
 * Report submitted by a peer
 */
export interface Report {
  reportID: string;
  reporter: string;
  reported: string;
  reason: ReportReason;
  evidence: string[];         // Message IDs, post IDs, etc.
  description: string;
  timestamp: number;
  signature: Uint8Array;
  status: ReportStatus;
}

/**
 * Reasons for reporting
 */
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'misinformation'
  | 'sybil_attack'
  | 'fraud'
  | 'other';

/**
 * Report status
 */
export type ReportStatus =
  | 'pending'
  | 'under_review'
  | 'in_court'
  | 'resolved'
  | 'dismissed';

/**
 * Court case created from a report
 */
export interface CourtCase {
  caseID: string;
  reportID: string;
  reporter: string;
  reported: string;
  reason: ReportReason;
  evidence: string[];
  jury: JuryMember[];
  verdict?: Verdict;
  votes: Record<string, Vote>;
  createdAt: number;
  resolvedAt?: number;
  status: CaseStatus;
}

/**
 * Jury member
 */
export interface JuryMember {
  peerID: string;
  reputationScore: number;
  selectedAt: number;
  voted: boolean;
  vote?: Vote;
}

/**
 * Vote cast by jury member
 */
export interface Vote {
  decision: Verdict;
  confidence: number;         // 0-1, how confident in decision
  reasoning?: string;
  timestamp: number;
  signature: Uint8Array;
}

/**
 * Verdict options
 */
export type Verdict =
  | 'guilty'
  | 'not_guilty'
  | 'inconclusive';

/**
 * Case status
 */
export type CaseStatus =
  | 'open'
  | 'voting'
  | 'deliberating'
  | 'closed'
  | 'appealed';

/**
 * Court configuration
 */
export interface CourtConfig {
  jurySize: number;           // Number of jurors (default: 7)
  minReputation: number;      // Minimum reputation to be juror (0-100)
  voteThreshold: number;      // Threshold for guilty verdict (0-1)
  votingPeriodHours: number;  // Hours for voting
  minParticipation: number;   // Minimum jurors required for verdict
  allowAppeals: boolean;      // Whether appeals are allowed
  appealPeriodHours: number;  // Hours to file appeal
}

/**
 * Moderation event for DHT announcement
 */
export interface ModerationEvent {
  eventID: string;
  type: 'report' | 'verdict' | 'appeal' | 'slash';
  caseID?: string;
  reported: string;
  verdict?: Verdict;
  slashAmount?: number;
  timestamp: number;
  signature: Uint8Array;
  ttl: number;
}

/**
 * Appeal request
 */
export interface AppealRequest {
  appealID: string;
  caseID: string;
  appellant: string;
  reason: string;
  newEvidence?: string[];
  requestedAt: number;
  status: 'pending' | 'accepted' | 'rejected';
  newJury?: JuryMember[];
  newVerdict?: Verdict;
}

/**
 * Court statistics
 */
export interface CourtStats {
  totalCases: number;
  activeCases: number;
  resolvedCases: number;
  averageResolutionTime: number;  // Hours
  guiltyRate: number;             // 0-1
  appealRate: number;             // 0-1
  juryParticipation: number;      // 0-1
}

/**
 * Juror performance tracking
 */
export interface JurorStats {
  peerID: string;
  casesServed: number;
  votesCast: number;
  majorityAlignment: number;      // 0-1, how often voted with majority
  averageConfidence: number;      // 0-1
  reputationChange: number;       // Net reputation from jury duty
}

/**
 * Moderation queue entry
 */
export interface QueueEntry {
  reportID: string;
  priority: number;               // Higher = more urgent
  submittedAt: number;
  assignedTo?: string;            // Court or admin
}
