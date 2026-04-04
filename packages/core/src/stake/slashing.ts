/* eslint-disable */
/**
 * Slashing Conditions
 * 
 * Defines valid reasons and amounts for stake slashing.
 * Used by community courts and automated detection.
 */

import type { StakeConfig, SlashingReason } from './types.js';

/**
 * Slashing condition definition
 */
export interface SlashingCondition {
  reason: SlashingReason;
  description: string;
  minEvidence: number;        // Minimum evidence items required
  slashPercentRange: [number, number]; // Min-max % of stake
  requiresCourt: boolean;     // Whether court verdict is required
  autoSlash: boolean;         // Can be auto-slashed without court
}

/**
 * Default slashing conditions
 */
const DEFAULT_CONDITIONS: Record<SlashingReason, SlashingCondition> = {
  spam: {
    reason: 'spam',
    description: 'Sending unsolicited bulk messages or announcements',
    minEvidence: 5,
    slashPercentRange: [5, 25],
    requiresCourt: false,
    autoSlash: true,
  },
  harassment: {
    reason: 'harassment',
    description: 'Targeted abuse, threats, or persistent unwanted contact',
    minEvidence: 3,
    slashPercentRange: [10, 50],
    requiresCourt: true,
    autoSlash: false,
  },
  sybil_attack: {
    reason: 'sybil_attack',
    description: 'Creating multiple identities to manipulate the system',
    minEvidence: 10,
    slashPercentRange: [50, 100],
    requiresCourt: true,
    autoSlash: false,
  },
  fraud: {
    reason: 'fraud',
    description: 'Deceptive practices, scams, or financial manipulation',
    minEvidence: 5,
    slashPercentRange: [50, 100],
    requiresCourt: true,
    autoSlash: false,
  },
  court_no_show: {
    reason: 'court_no_show',
    description: 'Failing to participate in assigned jury duty',
    minEvidence: 1,
    slashPercentRange: [5, 10],
    requiresCourt: false,
    autoSlash: true,
  },
  double_spend: {
    reason: 'double_spend',
    description: 'Attempting to spend the same stake twice',
    minEvidence: 1,
    slashPercentRange: [100, 100],
    requiresCourt: false,
    autoSlash: true,
  },
  protocol_violation: {
    reason: 'protocol_violation',
    description: 'Violating protocol rules or attempting exploits',
    minEvidence: 1,
    slashPercentRange: [50, 100],
    requiresCourt: false,
    autoSlash: true,
  },
  invalid_signature: {
    reason: 'invalid_signature',
    description: 'Submitting invalid or malformed signatures',
    minEvidence: 3,
    slashPercentRange: [10, 50],
    requiresCourt: true,
    autoSlash: false,
  },
  malicious_behavior: {
    reason: 'malicious_behavior',
    description: 'General malicious behavior not covered by other reasons',
    minEvidence: 5,
    slashPercentRange: [25, 100],
    requiresCourt: true,
    autoSlash: false,
  },
};

/**
 * Slashing Conditions manager
 */
export class SlashingConditions {
  private config: StakeConfig;
  private conditions: Record<SlashingReason, SlashingCondition>;

  constructor(config: StakeConfig, customConditions?: Partial<Record<SlashingReason, Partial<SlashingCondition>>>) {
    this.config = config;
    this.conditions = { ...DEFAULT_CONDITIONS };

    // Apply custom conditions if provided
    if (customConditions) {
      for (const [reason, overrides] of Object.entries(customConditions)) {
        const key = reason as SlashingReason;
        if (this.conditions[key]) {
          this.conditions[key] = {
            ...this.conditions[key],
            ...overrides,
          };
        }
      }
    }
  }

  /**
   * Validate if a reason is valid for slashing
   */
  validateReason(reason: SlashingReason): boolean {
    return reason in this.conditions;
  }

  /**
   * Get condition details for a reason
   */
  getCondition(reason: SlashingReason): SlashingCondition | undefined {
    return this.conditions[reason];
  }

  /**
   * Calculate slash amount based on severity
   * 
   * @param reason - Slashing reason
   * @param severity - Severity score (0-1, higher = more severe)
   * @param stakeAmount - Total stake amount
   * @returns Amount to slash in satoshis
   */
  calculateSlashAmount(
    reason: SlashingReason,
    severity: number,
    stakeAmount: number
  ): number {
    const condition = this.conditions[reason];
    if (!condition) {
      return 0;
    }

    // Clamp severity to 0-1
    const clampedSeverity = Math.max(0, Math.min(1, severity));

    // Calculate percentage within range
    const [minPercent, maxPercent] = condition.slashPercentRange;
    const slashPercent = minPercent + (maxPercent - minPercent) * clampedSeverity;

    // Calculate amount
    const slashAmount = (slashPercent / 100) * stakeAmount;

    // Apply max slashing limit from config
    const maxAllowed = (this.config.maxSlashingPercent / 100) * stakeAmount;

    return Math.min(slashAmount, maxAllowed);
  }

  /**
   * Check if evidence is sufficient for slashing
   */
  isEvidenceSufficient(reason: SlashingReason, evidenceCount: number): boolean {
    const condition = this.conditions[reason];
    if (!condition) {
      return false;
    }

    return evidenceCount >= condition.minEvidence;
  }

  /**
   * Check if court verdict is required for a reason
   */
  requiresCourtVerdict(reason: SlashingReason): boolean {
    const condition = this.conditions[reason];
    if (!condition) {
      return false;
    }

    return condition.requiresCourt;
  }

  /**
   * Check if auto-slashing is allowed for a reason
   */
  allowsAutoSlash(reason: SlashingReason): boolean {
    if (!this.config.slashingEnabled) {
      return false;
    }

    const condition = this.conditions[reason];
    if (!condition) {
      return false;
    }

    return condition.autoSlash;
  }

  /**
   * Get all slashing conditions for documentation
   */
  getAllConditions(): SlashingCondition[] {
    return Object.values(this.conditions);
  }

  /**
   * Get severity guidelines for a reason
   */
  getSeverityGuidelines(reason: SlashingReason): {
    low: { severity: number; description: string; slashPercent: number };
    medium: { severity: number; description: string; slashPercent: number };
    high: { severity: number; description: string; slashPercent: number };
  } {
    const condition = this.conditions[reason];
    if (!condition) {
      throw new Error(`Unknown slashing reason: ${reason}`);
    }

    const [minPercent, maxPercent] = condition.slashPercentRange;
    const range = maxPercent - minPercent;

    return {
      low: {
        severity: 0.2,
        description: 'Minor violation, first offense',
        slashPercent: minPercent + range * 0.2,
      },
      medium: {
        severity: 0.5,
        description: 'Moderate violation or repeat offense',
        slashPercent: minPercent + range * 0.5,
      },
      high: {
        severity: 0.9,
        description: 'Severe violation or persistent abuse',
        slashPercent: minPercent + range * 0.9,
      },
    };
  }

  /**
   * Export conditions for UI display
   */
  exportForUI(): Array<{
    reason: string;
    description: string;
    minEvidence: number;
    slashRange: string;
    requiresCourt: boolean;
  }> {
    return Object.values(this.conditions).map(c => ({
      reason: c.reason,
      description: c.description,
      minEvidence: c.minEvidence,
      slashRange: `${c.slashPercentRange[0]}-${c.slashPercentRange[1]}%`,
      requiresCourt: c.requiresCourt,
    }));
  }
}

/**
 * Automated slashing detection
 * 
 * Monitors for behavior that should trigger auto-slashing
 */
export class AutomatedSlashingDetector {
  private spamThreshold: number;
  private timeWindowMs: number;

  constructor(spamThreshold: number = 10, timeWindowMinutes: number = 5) {
    this.spamThreshold = spamThreshold;
    this.timeWindowMs = timeWindowMinutes * 60 * 1000;
  }

  /**
   * Track message timestamps for spam detection
   */
  private messageTimestamps: Map<string, number[]> = new Map();

  /**
   * Record a message/announcement from a peer
   */
  recordMessage(peerID: string, timestamp: number = Date.now()): void {
    if (!this.messageTimestamps.has(peerID)) {
      this.messageTimestamps.set(peerID, []);
    }

    const timestamps = this.messageTimestamps.get(peerID)!;
    timestamps.push(timestamp);

    // Clean old timestamps
    const cutoff = timestamp - this.timeWindowMs;
    const filtered = timestamps.filter(t => t > cutoff);
    this.messageTimestamps.set(peerID, filtered);
  }

  /**
   * Check if peer should be auto-slashed for spam
   */
  detectSpam(peerID: string): { detected: boolean; count: number } {
    const timestamps = this.messageTimestamps.get(peerID) || [];
    const count = timestamps.length;

    return {
      detected: count >= this.spamThreshold,
      count,
    };
  }

  /**
   * Clear tracking data
   */
  clear(): void {
    this.messageTimestamps.clear();
  }

  /**
   * Get detected violations
   */
  getViolations(): Array<{ peerID: string; reason: SlashingReason; count: number }> {
    const violations: Array<{ peerID: string; reason: SlashingReason; count: number }> = [];

    for (const [peerID, timestamps] of this.messageTimestamps.entries()) {
      if (timestamps.length >= this.spamThreshold) {
        violations.push({
          peerID,
          reason: 'spam',
          count: timestamps.length,
        });
      }
    }

    return violations;
  }
}
