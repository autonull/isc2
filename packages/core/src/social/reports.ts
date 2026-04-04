/* eslint-disable */
import type { Keypair } from '../crypto/keypair.js';
import { sign } from '../crypto/signing.js';
import type { CommunityReport } from './types.js';

export type ReportReason = 'off-topic' | 'spam' | 'harassment' | 'misinformation' | 'violation';

export interface CreateReportOptions {
  keypair: Keypair;
  reporter: string;
  reported: string;
  reason: ReportReason;
  evidence: string[];
  targetPostID?: string;
  targetChannelID?: string;
}

export async function createCommunityReport(options: CreateReportOptions): Promise<CommunityReport> {
  const { keypair, reporter, reported, reason, evidence, targetPostID, targetChannelID } = options;
  
  const payload = {
    reporter,
    reported,
    reason,
    evidence,
    timestamp: Date.now(),
    ...(targetPostID ? { targetPostID } : {}),
    ...(targetChannelID ? { targetChannelID } : {}),
  };

  const encoder = new TextEncoder();
  const encoded = encoder.encode(JSON.stringify(payload));
  const signature = await sign(encoded, keypair.privateKey);

  return {
    id: `report_${Math.random().toString(36).substring(2, 10)}`,
    ...payload,
    signature,
  };
}

export function validateReportReason(reason: string): reason is ReportReason {
  return ['off-topic', 'spam', 'harassment', 'misinformation', 'violation'].includes(reason);
}

export interface ReportStats {
  total: number;
  byReason: Record<ReportReason, number>;
  pending: number;
  resolved: number;
}

export function calculateReportStats(reports: CommunityReport[]): ReportStats {
  const stats: ReportStats = {
    total: reports.length,
    byReason: {
      'off-topic': 0,
      'spam': 0,
      'harassment': 0,
      'misinformation': 0,
      'violation': 0,
    },
    pending: 0,
    resolved: 0,
  };

  for (const report of reports) {
    if (validateReportReason(report.reason)) {
      stats.byReason[report.reason]++;
    }
  }

  return stats;
}
