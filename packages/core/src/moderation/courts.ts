/**
 * Moderation Court System
 * 
 * Manages court cases, jury selection, and verdict execution.
 * Integrates with reputation and stake systems for enforcement.
 */

import type {
  CourtCase,
  Report,
  Verdict,
  CourtConfig,
  AppealRequest,
  CourtStats,
  Vote,
  QueueEntry,
} from './types.js';
import { JurySelector } from './jury.js';
import { QuadraticVoting } from './voting.js';
import { ReputationScorer } from '../reputation/scorer.js';
import { StakeManager } from '../stake/manager.js';

/**
 * Default court configuration
 */
const DEFAULT_CONFIG: CourtConfig = {
  jurySize: 7,
  minReputation: 30,
  voteThreshold: 0.6,
  votingPeriodHours: 24,
  minParticipation: 5,
  allowAppeals: true,
  appealPeriodHours: 72,
};

/**
 * Moderation Court class
 */
export class ModerationCourt {
  private config: CourtConfig;
  private reports: Map<string, Report> = new Map();
  private cases: Map<string, CourtCase> = new Map();
  private appeals: Map<string, AppealRequest> = new Map();
  private queue: QueueEntry[] = [];
  private reputationScorer?: ReputationScorer;
  private stakeManager?: StakeManager;
  private jurySelector: JurySelector;
  private voting: QuadraticVoting;

  constructor(
    config: Partial<CourtConfig> = {},
    reputationScorer?: ReputationScorer,
    stakeManager?: StakeManager
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.reputationScorer = reputationScorer;
    this.stakeManager = stakeManager;
    this.jurySelector = new JurySelector(this.config, reputationScorer);
    this.voting = new QuadraticVoting();
  }

  /**
   * Submit a new report
   */
  submitReport(
    reporter: string,
    reported: string,
    reason: string,
    evidence: string[],
    description: string,
    signature: Uint8Array
  ): Report {
    const report: Report = {
      reportID: `report_${crypto.randomUUID()}`,
      reporter,
      reported,
      reason: reason as any,
      evidence,
      description,
      timestamp: Date.now(),
      signature,
      status: 'pending',
    };

    this.reports.set(report.reportID, report);

    // Add to queue with priority based on reason
    const priority = this.calculateReportPriority(reason);
    this.queue.push({
      reportID: report.reportID,
      priority,
      submittedAt: Date.now(),
    });

    // Sort queue by priority
    this.queue.sort((a, b) => b.priority - a.priority);

    return report;
  }

  /**
   * Calculate report priority based on reason
   */
  private calculateReportPriority(reason: string): number {
    const priorities: Record<string, number> = {
      sybil_attack: 100,
      fraud: 90,
      hate_speech: 80,
      harassment: 70,
      misinformation: 60,
      spam: 40,
      other: 20,
    };
    return priorities[reason] || 20;
  }

  /**
   * Process queue and create court cases
   */
  processQueue(): CourtCase[] {
    const newCases: CourtCase[] = [];

    while (this.queue.length > 0) {
      const entry = this.queue.shift()!;
      const report = this.reports.get(entry.reportID);

      if (!report || report.status !== 'pending') {
        continue;
      }

      // Create court case
      const case_ = this.createCourtCase(report);
      newCases.push(case_);
    }

    return newCases;
  }

  /**
   * Create a court case from a report
   */
  private createCourtCase(report: Report): CourtCase {
    // Select jury
    const jury = this.jurySelector.selectJury(
      report.reporter,
      report.reported,
      this.config.jurySize
    );

    const case_: CourtCase = {
      caseID: `case_${crypto.randomUUID()}`,
      reportID: report.reportID,
      reporter: report.reporter,
      reported: report.reported,
      reason: report.reason,
      evidence: report.evidence,
      jury,
      votes: {},
      createdAt: Date.now(),
      status: 'open',
    };

    this.cases.set(case_.caseID, case_);
    report.status = 'in_court';

    return case_;
  }

  /**
   * Cast a vote in a court case
   */
  castVote(
    caseID: string,
    jurorPeerID: string,
    decision: Verdict,
    confidence: number,
    reasoning: string,
    signature: Uint8Array
  ): { success: boolean; error?: string } {
    const case_ = this.cases.get(caseID);

    if (!case_) {
      return { success: false, error: 'Case not found' };
    }

    if (case_.status === 'closed') {
      return { success: false, error: 'Case is closed' };
    }

    // Verify juror is in the jury
    const juror = case_.jury.find(j => j.peerID === jurorPeerID);
    if (!juror) {
      return { success: false, error: 'Not a jury member' };
    }

    if (juror.voted) {
      return { success: false, error: 'Already voted' };
    }

    // Check voting period
    const votingDeadline = case_.createdAt + this.config.votingPeriodHours * 60 * 60 * 1000;
    if (Date.now() > votingDeadline) {
      return { success: false, error: 'Voting period expired' };
    }

    // Record vote
    const vote: Vote = {
      decision,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning,
      timestamp: Date.now(),
      signature,
    };

    case_.votes[jurorPeerID] = vote;
    juror.voted = true;
    juror.vote = vote;

    // Check if voting is complete
    this.checkVotingComplete(case_);

    return { success: true };
  }

  /**
   * Check if voting is complete and tally results
   */
  private checkVotingComplete(case_: CourtCase): void {
    const votesCast = Object.keys(case_.votes).length;

    if (votesCast >= this.config.minParticipation) {
      // Tally votes using quadratic voting
      const result = this.voting.tallyVotes(case_.votes, this.config.voteThreshold);

      if (result.conclusive) {
        case_.verdict = result.verdict;
        case_.status = 'closed';
        case_.resolvedAt = Date.now();

        // Execute verdict
        this.executeVerdict(case_);
      } else if (votesCast >= case_.jury.length) {
        // All jurors voted but no clear verdict
        case_.verdict = 'inconclusive';
        case_.status = 'closed';
        case_.resolvedAt = Date.now();
      }
    }
  }

  /**
   * Execute verdict (slash stake, update reputation)
   */
  private executeVerdict(case_: CourtCase): void {
    if (!case_.verdict || case_.verdict !== 'guilty') {
      return;
    }

    // Slash stake if stake manager is configured
    if (this.stakeManager) {
      const bond = this.stakeManager.getBond(case_.reported);
      if (bond) {
        // Calculate slash amount based on reason
        const slashPercent = this.getSlashPercentForReason(case_.reason);
        const slashAmount = Math.floor(bond.amountSats * slashPercent);

        // Map ReportReason to SlashingReason
        const slashingReason = this.mapToSlashingReason(case_.reason);

        const signature = new Uint8Array(64); // Court signature
        this.stakeManager.slashStake(
          case_.reported,
          slashingReason,
          slashAmount,
          case_.evidence,
          case_.jury.map(j => j.peerID),
          signature
        );
      }
    }

    // Update reputation
    if (this.reputationScorer) {
      // Guilty verdict reduces reputation
      // This would be implemented in ReputationScorer
    }
  }

  /**
   * Get slash percentage for a reason
   */
  private getSlashPercentForReason(reason: string): number {
    const percentages: Record<string, number> = {
      sybil_attack: 1.0,
      fraud: 0.8,
      hate_speech: 0.5,
      harassment: 0.4,
      misinformation: 0.3,
      spam: 0.1,
      other: 0.1,
    };
    return percentages[reason] || 0.1;
  }

  /**
   * Map ReportReason to SlashingReason
   */
  private mapToSlashingReason(reason: string): 'spam' | 'harassment' | 'sybil_attack' | 'fraud' {
    switch (reason) {
      case 'spam':
        return 'spam';
      case 'harassment':
      case 'hate_speech':
        return 'harassment';
      case 'sybil_attack':
        return 'sybil_attack';
      case 'fraud':
      case 'misinformation':
        return 'fraud';
      default:
        return 'spam';
    }
  }

  /**
   * File an appeal
   */
  fileAppeal(
    caseID: string,
    appellant: string,
    reason: string,
    newEvidence?: string[]
  ): { success: boolean; appeal?: AppealRequest; error?: string } {
    if (!this.config.allowAppeals) {
      return { success: false, error: 'Appeals not allowed' };
    }

    const case_ = this.cases.get(caseID);
    if (!case_) {
      return { success: false, error: 'Case not found' };
    }

    if (case_.status !== 'closed') {
      return { success: false, error: 'Case is not closed' };
    }

    if (!case_.resolvedAt) {
      return { success: false, error: 'Case has no resolution' };
    }

    // Check appeal period
    const appealDeadline = case_.resolvedAt + this.config.appealPeriodHours * 60 * 60 * 1000;
    if (Date.now() > appealDeadline) {
      return { success: false, error: 'Appeal period expired' };
    }

    // Only reported party can appeal
    if (appellant !== case_.reported) {
      return { success: false, error: 'Only reported party can appeal' };
    }

    const appeal: AppealRequest = {
      appealID: `appeal_${crypto.randomUUID()}`,
      caseID,
      appellant,
      reason,
      newEvidence,
      requestedAt: Date.now(),
      status: 'pending',
    };

    this.appeals.set(appeal.appealID, appeal);
    case_.status = 'appealed';

    return { success: true, appeal };
  }

  /**
   * Process an appeal
   */
  processAppeal(
    appealID: string,
    accept: boolean
  ): { success: boolean; error?: string } {
    const appeal = this.appeals.get(appealID);
    if (!appeal) {
      return { success: false, error: 'Appeal not found' };
    }

    if (appeal.status !== 'pending') {
      return { success: false, error: 'Appeal already processed' };
    }

    const case_ = this.cases.get(appeal.caseID);
    if (!case_) {
      return { success: false, error: 'Case not found' };
    }

    if (accept) {
      // Select new jury and reopen case
      const newJury = this.jurySelector.selectJury(
        case_.reporter,
        case_.reported,
        this.config.jurySize
      );

      appeal.status = 'accepted';
      appeal.newJury = newJury;

      // Reset case for new trial
      case_.jury = newJury;
      case_.votes = {};
      case_.verdict = undefined;
      case_.status = 'open';
      case_.resolvedAt = undefined;
    } else {
      appeal.status = 'rejected';
      case_.status = 'closed';
    }

    return { success: true };
  }

  /**
   * Get court case by ID
   */
  getCase(caseID: string): CourtCase | undefined {
    return this.cases.get(caseID);
  }

  /**
   * Get all active cases
   */
  getActiveCases(): CourtCase[] {
    return Array.from(this.cases.values()).filter(
      c => c.status !== 'closed'
    );
  }

  /**
   * Get court statistics
   */
  getStats(): CourtStats {
    const cases = Array.from(this.cases.values());
    const resolvedCases = cases.filter(c => c.status === 'closed');
    const appealedCases = cases.filter(c => c.status === 'appealed');

    const guiltyVerdicts = resolvedCases.filter(c => c.verdict === 'guilty');

    // Calculate average resolution time
    const resolutionTimes = resolvedCases
      .filter(c => c.resolvedAt)
      .map(c => (c.resolvedAt! - c.createdAt) / (1000 * 60 * 60)); // Hours
    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    // Calculate jury participation
    let totalVotes = 0;
    let totalPossibleVotes = 0;
    for (const case_ of cases) {
      totalVotes += Object.keys(case_.votes).length;
      totalPossibleVotes += case_.jury.length;
    }

    return {
      totalCases: cases.length,
      activeCases: this.getActiveCases().length,
      resolvedCases: resolvedCases.length,
      averageResolutionTime: avgResolutionTime,
      guiltyRate: resolvedCases.length > 0 ? guiltyVerdicts.length / resolvedCases.length : 0,
      appealRate: cases.length > 0 ? appealedCases.length / cases.length : 0,
      juryParticipation: totalPossibleVotes > 0 ? totalVotes / totalPossibleVotes : 0,
    };
  }

  /**
   * Export state for persistence
   */
  export(): {
    reports: Map<string, Report>;
    cases: Map<string, CourtCase>;
    appeals: Map<string, AppealRequest>;
    queue: QueueEntry[];
  } {
    return {
      reports: this.reports,
      cases: this.cases,
      appeals: this.appeals,
      queue: [...this.queue],
    };
  }

  /**
   * Import state from persistence
   */
  import(state: {
    reports: Map<string, Report>;
    cases: Map<string, CourtCase>;
    appeals: Map<string, AppealRequest>;
    queue: QueueEntry[];
  }): void {
    this.reports = state.reports;
    this.cases = state.cases;
    this.appeals = state.appeals;
    this.queue = [...state.queue];
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.reports.clear();
    this.cases.clear();
    this.appeals.clear();
    this.queue = [];
  }
}
