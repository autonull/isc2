/**
 * Content Moderation Service
 *
 * Handles mute/block, reports, and community council moderation.
 * References: SOCIAL.md#semantic-moderation
 */

import { sign, encode, decode } from '@isc/core';
import type { SignedPost, CommunityReport, CommunityCouncil } from './types.js';
import { getPeerID, getKeypair } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { computeReputation } from './graph.js';

const DEFAULT_TTL = 86400 * 30; // 30 days

// ============================================================================
// Mute/Block Functions
// ============================================================================

/**
 * Mute a peer - hides their content from your feeds
 */
export async function muteUser(peerID: string): Promise<void> {
  const db = await getModerationDB();
  await db.transaction('mutes', 'readwrite').objectStore('mutes').put({
    peerID,
    mutedAt: Date.now(),
  });
}

/**
 * Unmute a peer
 */
export async function unmuteUser(peerID: string): Promise<void> {
  const db = await getModerationDB();
  await db.transaction('mutes', 'readwrite').objectStore('mutes').delete(peerID);
}

/**
 * Get list of muted users
 */
export async function getMutedUsers(): Promise<string[]> {
  const db = await getModerationDB();
  const mutes = await db.transaction('mutes', 'readonly').objectStore('mutes').getAll();
  return mutes.map((m: { peerID: string }) => m.peerID);
}

/**
 * Block a peer - prevents all interaction and content visibility
 */
export async function blockUser(peerID: string): Promise<void> {
  const actor = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const blockEvent = {
    type: 'block' as const,
    blocker: actor,
    blocked: peerID,
    timestamp: Date.now(),
  };

  const signature = await sign(encode(blockEvent), keypair.privateKey);

  const db = await getModerationDB();
  await db.transaction('blocks', 'readwrite').objectStore('blocks').put({
    peerID,
    blockedAt: Date.now(),
  });

  // Announce to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    await client.announce(`/isc/block/${actor}/${peerID}`, encode({ ...blockEvent, signature }), DEFAULT_TTL);
  }
}

/**
 * Unblock a peer
 */
export async function unblockUser(peerID: string): Promise<void> {
  const db = await getModerationDB();
  await db.transaction('blocks', 'readwrite').objectStore('blocks').delete(peerID);

  // Announce unblock to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    const actor = await getPeerID();
    const keypair = getKeypair();
    if (!keypair) return;

    const unblockEvent = {
      type: 'unblock' as const,
      blocker: actor,
      blocked: peerID,
      timestamp: Date.now(),
    };

    const signature = await sign(encode(unblockEvent), keypair.privateKey);
    await client.announce(`/isc/block/${actor}/${peerID}`, encode({ ...unblockEvent, signature }), 86400);
  }
}

/**
 * Get list of blocked users
 */
export async function getBlockedUsers(): Promise<string[]> {
  const db = await getModerationDB();
  const blocks = await db.transaction('blocks', 'readonly').objectStore('blocks').getAll();
  return blocks.map((b: { peerID: string }) => b.peerID);
}

/**
 * Check if a peer is muted
 */
export async function isMuted(peerID: string): Promise<boolean> {
  const muted = await getMutedUsers();
  return muted.includes(peerID);
}

/**
 * Check if a peer is blocked
 */
export async function isBlocked(peerID: string): Promise<boolean> {
  const blocked = await getBlockedUsers();
  return blocked.includes(peerID);
}

/**
 * Filter posts by muted and blocked users
 */
export function filterModeratedPosts(
  posts: SignedPost[],
  muted: string[],
  blocked: string[]
): SignedPost[] {
  const excluded = new Set([...muted, ...blocked]);
  return posts.filter((post) => !excluded.has(post.author));
}

// ============================================================================
// Report Functions
// ============================================================================

/**
 * Report a user for violating community guidelines
 */
export async function reportUser(
  reported: string,
  reason: string,
  evidence: string[]
): Promise<CommunityReport> {
  const reporter = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const report: Omit<CommunityReport, 'signature'> = {
    id: `report_${crypto.randomUUID()}`,
    reporter,
    reported,
    reason,
    evidence,
    timestamp: Date.now(),
  };

  const signature = await sign(encode(report), keypair.privateKey);
  const signedReport: CommunityReport = { ...report, signature };

  // Store locally
  const db = await getModerationDB();
  await db.transaction('reports', 'readwrite').objectStore('reports').put(signedReport);

  // Announce to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    await client.announce(`/isc/report/${signedReport.id}`, encode(signedReport), DEFAULT_TTL);
  }

  return signedReport;
}

/**
 * Get pending reports (for council members)
 */
export async function getPendingReports(): Promise<CommunityReport[]> {
  const db = await getModerationDB();
  const reports = await db.transaction('reports', 'readonly').objectStore('reports').getAll();

  // Filter to pending reports (not yet decided)
  const decisions = await db.transaction('decisions', 'readonly').objectStore('decisions').getAll();
  const decidedIds = new Set(decisions.map((d: { reportId: string }) => d.reportId));

  return reports.filter((r: CommunityReport) => !decidedIds.has(r.id));
}

/**
 * Get reports for a specific post/user
 */
export async function getReportsForTarget(targetId: string): Promise<CommunityReport[]> {
  const db = await getModerationDB();
  const reports = await db.transaction('reports', 'readonly').objectStore('reports').getAll();
  return reports.filter(
    (r: CommunityReport) => r.reported === targetId || r.evidence.includes(targetId)
  );
}

/**
 * Vote on a report (for council members)
 */
export async function voteOnReport(
  reportId: string,
  decision: 'guilty' | 'not_guilty'
): Promise<void> {
  const voter = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const vote = {
    id: `vote_${crypto.randomUUID()}`,
    reportId,
    voter,
    decision,
    timestamp: Date.now(),
  };

  const signature = await sign(encode(vote), keypair.privateKey);

  // Store vote
  const db = await getModerationDB();
  await db.transaction('votes', 'readwrite').objectStore('votes').put({ ...vote, signature });

  // Check if threshold is met and process decision
  await processReportDecision(reportId);
}

/**
 * Process a report decision based on votes
 */
async function processReportDecision(reportId: string): Promise<void> {
  const db = await getModerationDB();
  const report = await db.transaction('reports', 'readonly').objectStore('reports').get(reportId);
  if (!report) return;

  const votes = await db.transaction('votes', 'readonly').objectStore('votes').getAll();
  const reportVotes = votes.filter((v: { reportId: string }) => v.reportId === reportId);

  const guiltyCount = reportVotes.filter((v: { decision: string }) => v.decision === 'guilty').length;
  const notGuiltyCount = reportVotes.filter((v: { decision: string }) => v.decision === 'not_guilty').length;

  // Simple majority threshold (can be customized per council)
  const threshold = 3;

  if (guiltyCount >= threshold) {
    await db.transaction('decisions', 'readwrite').objectStore('decisions').put({
      reportId,
      outcome: 'guilty' as const,
      decidedAt: Date.now(),
      voteCount: guiltyCount,
    });
  } else if (notGuiltyCount >= threshold) {
    await db.transaction('decisions', 'readwrite').objectStore('decisions').put({
      reportId,
      outcome: 'not_guilty' as const,
      decidedAt: Date.now(),
      voteCount: notGuiltyCount,
    });
  }
}

// ============================================================================
// Community Council Functions
// ============================================================================

/**
 * Create a community council for moderation
 */
export async function createCouncil(
  name: string,
  jurisdiction: string[],
  members: string[]
): Promise<CommunityCouncil> {
  const creator = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const council: Omit<CommunityCouncil, 'signature'> = {
    id: `council_${crypto.randomUUID()}`,
    name,
    members: [...new Set([...members, creator])],
    threshold: Math.ceil(members.length / 2) + 1,
    jurisdiction,
  };

  const signature = await sign(encode(council), keypair.privateKey);
  const signedCouncil: CommunityCouncil = { ...council, signature };

  // Store locally
  const db = await getModerationDB();
  await db.transaction('councils', 'readwrite').objectStore('councils').put(signedCouncil);

  // Announce to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    await client.announce(`/isc/council/${signedCouncil.id}`, encode(signedCouncil), DEFAULT_TTL);
  }

  return signedCouncil;
}

/**
 * Get council by ID
 */
export async function getCouncil(councilId: string): Promise<CommunityCouncil | null> {
  const db = await getModerationDB();
  return db.transaction('councils', 'readonly').objectStore('councils').get(councilId);
}

/**
 * Get councils with jurisdiction over a channel
 */
export async function getCouncilsForChannel(channelID: string): Promise<CommunityCouncil[]> {
  const db = await getModerationDB();
  const councils = await db.transaction('councils', 'readonly').objectStore('councils').getAll();
  return councils.filter((c: CommunityCouncil) =>
    c.jurisdiction.includes(channelID) || c.jurisdiction.includes('*')
  );
}

/**
 * Get councils the current user is a member of
 */
export async function getMyCouncils(): Promise<CommunityCouncil[]> {
  const peerID = await getPeerID();
  const db = await getModerationDB();
  const councils = await db.transaction('councils', 'readonly').objectStore('councils').getAll();
  return councils.filter((c: CommunityCouncil) => c.members.includes(peerID));
}

/**
 * Check if user is eligible for council membership
 */
export async function isCouncilEligible(peerID: string, minReputation: number = 0.7): Promise<boolean> {
  const rep = await computeReputation(peerID);
  return rep.score >= minReputation;
}

// ============================================================================
// Database Helpers
// ============================================================================

async function getModerationDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-moderation', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('mutes')) {
        db.createObjectStore('mutes', { keyPath: 'peerID' });
      }
      if (!db.objectStoreNames.contains('blocks')) {
        db.createObjectStore('blocks', { keyPath: 'peerID' });
      }
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('votes')) {
        db.createObjectStore('votes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('councils')) {
        db.createObjectStore('councils', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('decisions')) {
        db.createObjectStore('decisions', { keyPath: 'reportId' });
      }
    };
  });
}
