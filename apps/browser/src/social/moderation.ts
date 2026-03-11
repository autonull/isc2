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

/**
 * Check if a post is still valid (not expired)
 */
export function isPostValid(post: { timestamp: number; ttl: number }): boolean {
  const now = Date.now();
  const expiry = post.timestamp + post.ttl * 1000;
  return now < expiry;
}

/**
 * Filter posts from muted users
 */
export function filterMutedPosts<T extends { author: string }>(posts: T[], muted: string[]): T[] {
  const mutedSet = new Set(muted);
  return posts.filter((post) => !mutedSet.has(post.author));
}

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
  return new Promise((resolve) => {
    const req = db.transaction('mutes', 'readonly').objectStore('mutes').getAll();
    req.onsuccess = () => {
      const mutes = req.result || [];
      resolve(mutes.map((m: { peerID: string }) => m.peerID));
    };
    req.onerror = () => resolve([]);
  });
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
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction('blocks', 'readwrite').objectStore('blocks').put({
      peerID,
      blockedAt: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
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
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction('blocks', 'readwrite').objectStore('blocks').delete(peerID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

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
  return new Promise((resolve) => {
    const req = db.transaction('blocks', 'readonly').objectStore('blocks').getAll();
    req.onsuccess = () => {
      const blocks = req.result || [];
      resolve(blocks.map((b: { peerID: string }) => b.peerID));
    };
    req.onerror = () => resolve([]);
  });
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
  return new Promise((resolve) => {
    const req = db.transaction('reports', 'readonly').objectStore('reports').getAll();
    req.onsuccess = () => {
      const reports = req.result || [];
      const decReq = db.transaction('decisions', 'readonly').objectStore('decisions').getAll();
      decReq.onsuccess = () => {
        const decisions = decReq.result || [];
        const decidedIds = new Set(decisions.map((d: { reportId: string }) => d.reportId));
        resolve(reports.filter((r: CommunityReport) => !decidedIds.has(r.id)));
      };
      decReq.onerror = () => resolve(reports);
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Get reports for a specific post/user
 */
export async function getReportsForTarget(targetId: string): Promise<CommunityReport[]> {
  const db = await getModerationDB();
  return new Promise((resolve) => {
    const req = db.transaction('reports', 'readonly').objectStore('reports').getAll();
    req.onsuccess = () => {
      const reports = req.result || [];
      resolve(reports.filter(
        (r: CommunityReport) => r.reported === targetId || r.evidence.includes(targetId)
      ));
    };
    req.onerror = () => resolve([]);
  });
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
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction('votes', 'readwrite').objectStore('votes').put({ ...vote, signature });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Check if threshold is met and process decision
  await processReportDecision(reportId);
}

/**
 * Process a report decision based on votes
 */
async function processReportDecision(reportId: string): Promise<void> {
  const db = await getModerationDB();
  
  const report = await new Promise<any>((resolve) => {
    const req = db.transaction('reports', 'readonly').objectStore('reports').get(reportId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  if (!report) return;

  const votes = await new Promise<any[]>((resolve) => {
    const req = db.transaction('votes', 'readonly').objectStore('votes').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
  
  const reportVotes = votes.filter((v: { reportId: string }) => v.reportId === reportId);
  const guiltyCount = reportVotes.filter((v: { decision: string }) => v.decision === 'guilty').length;
  const notGuiltyCount = reportVotes.filter((v: { decision: string }) => v.decision === 'not_guilty').length;

  // Simple majority threshold (can be customized per council)
  const threshold = 3;

  if (guiltyCount >= threshold) {
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction('decisions', 'readwrite').objectStore('decisions').put({
        reportId,
        outcome: 'guilty' as const,
        decidedAt: Date.now(),
        voteCount: guiltyCount,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } else if (notGuiltyCount >= threshold) {
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction('decisions', 'readwrite').objectStore('decisions').put({
        reportId,
        outcome: 'not_guilty' as const,
        decidedAt: Date.now(),
        voteCount: notGuiltyCount,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
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
    reputationThreshold: 0.7,
  };

  const signature = await sign(encode(council), keypair.privateKey);
  const signedCouncil: CommunityCouncil = { ...council, signature };

  // Store locally
  const db = await getModerationDB();
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction('councils', 'readwrite').objectStore('councils').put(signedCouncil);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

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
  return new Promise((resolve) => {
    const req = db.transaction('councils', 'readonly').objectStore('councils').get(councilId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

/**
 * Get councils with jurisdiction over a channel
 */
export async function getCouncilsForChannel(channelID: string): Promise<CommunityCouncil[]> {
  const db = await getModerationDB();
  return new Promise((resolve) => {
    const req = db.transaction('councils', 'readonly').objectStore('councils').getAll();
    req.onsuccess = () => {
      const councils = req.result || [];
      resolve(councils.filter((c: CommunityCouncil) =>
        c.jurisdiction.includes(channelID) || c.jurisdiction.includes('*')
      ));
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Get councils the current user is a member of
 */
export async function getMyCouncils(): Promise<CommunityCouncil[]> {
  const peerID = await getPeerID();
  const db = await getModerationDB();
  return new Promise((resolve) => {
    const req = db.transaction('councils', 'readonly').objectStore('councils').getAll();
    req.onsuccess = () => {
      const councils = req.result || [];
      resolve(councils.filter((c: CommunityCouncil) => c.members.includes(peerID)));
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Check if user is eligible for council membership
 */
export async function isCouncilEligible(peerID: string, minReputation: number = 0.7): Promise<boolean> {
  const rep = await computeReputation(peerID);
  return rep.score >= minReputation;
}

// ============================================================================
// Test-Compatible Aliases (for reputation.test.ts)
// ============================================================================

/**
 * Alias for blockUser (test-compatible naming)
 */
export async function blockPeer(peerID: string): Promise<{
  type: 'block';
  blocked: string;
  timestamp: number;
  signature: any;
}> {
  await blockUser(peerID);
  const actor = await getPeerID();
  const keypair = getKeypair();
  const blockEvent = {
    type: 'block' as const,
    blocker: actor,
    blocked: peerID,
    timestamp: Date.now(),
  };
  const signature = keypair ? await sign(encode(blockEvent), keypair.privateKey) : new Uint8Array();
  return { ...blockEvent, signature };
}

/**
 * Alias for unblockUser (test-compatible naming)
 */
export async function unblockPeer(peerID: string): Promise<void> {
  await unblockUser(peerID);
}

/**
 * Alias for getBlockedUsers (test-compatible naming)
 */
export async function getBlockedPeers(): Promise<string[]> {
  return getBlockedUsers();
}

/**
 * Alias for voteOnReport (test-compatible naming)
 */
export async function submitModerationVote(reportId: string, decision: 'guilty' | 'not_guilty'): Promise<void> {
  await voteOnReport(reportId, decision);
}

/**
 * Process moderation decision based on votes
 */
export async function processModerationDecision(
  reportId: string,
  councilId: string
): Promise<{ outcome: 'guilty' | 'not_guilty'; voteCount: number } | null> {
  const db = await getModerationDB();

  // Get council
  const council = await getCouncil(councilId);
  if (!council) return null;

  // Get report
  const report = await new Promise<any>((resolve) => {
    const req = db.transaction('reports', 'readonly').objectStore('reports').get(reportId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  if (!report) return null;

  // Get votes
  const votes = await new Promise<any[]>((resolve) => {
    const req = db.transaction('votes', 'readonly').objectStore('votes').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  const reportVotes = votes.filter((v) => v.reportId === reportId);
  const guiltyCount = reportVotes.filter((v) => v.decision === 'guilty').length;
  const notGuiltyCount = reportVotes.filter((v) => v.decision === 'not_guilty').length;

  if (guiltyCount >= council.threshold) {
    return { outcome: 'guilty', voteCount: guiltyCount };
  } else if (notGuiltyCount >= council.threshold) {
    return { outcome: 'not_guilty', voteCount: notGuiltyCount };
  }

  return null;
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
