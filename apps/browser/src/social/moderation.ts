/**
 * Content Moderation Service
 *
 * Handles semantic moderation, reports, mute/block, and reputation-based filtering.
 * References: SOCIAL.md#semantic-moderation, Phase 6 Reputation & Moderation
 */

import { cosineSimilarity } from '@isc/core/math';
import { sign, encode } from '@isc/core/crypto';
import type {
  SignedPost,
  ChannelSummary,
  CommunityReport,
  ReputationScore,
  BlockEvent,
  CommunityCouncil,
  ModerationVote,
  ModerationDecision,
} from './types';
import { getChannel } from '../channels/manager';
import { computeReputation, getAllKnownPeers } from './graph';
import { getPeerID, getKeypair } from '../identity';

/** Minimum coherence threshold for posts */
const MIN_COHERENCE = 0.5;

/**
 * Check if post is coherent with channel topic
 */
export async function checkPostCoherence(
  post: SignedPost,
  channelID: string
): Promise<number> {
  const channel = await getChannel(channelID);
  if (!channel) return 0;

  const channelEmbedding = channel.distributions[0]?.mu ?? [];
  if (channelEmbedding.length === 0) return 1;

  return cosineSimilarity(channelEmbedding, post.embedding);
}

/**
 * Filter posts by coherence threshold
 */
export async function filterIncoherentPosts(
  posts: SignedPost[],
  channelID: string,
  threshold: number = MIN_COHERENCE
): Promise<SignedPost[]> {
  const coherent: SignedPost[] = [];

  for (const post of posts) {
    const coherence = await checkPostCoherence(post, channelID);
    if (coherence >= threshold) {
      coherent.push(post);
    }
  }

  return coherent;
}

/**
 * Submit a community report
 */
export async function submitReport(
  postID: string,
  reason: CommunityReport['reason'],
  evidence: string
): Promise<CommunityReport> {
  const { sign, encode } = await import('@isc/core/crypto');
  const { getPeerID, getKeypair } = await import('../identity');

  const report: CommunityReport = {
    reporter: await getPeerID(),
    targetPostID: postID,
    reason,
    evidence,
    signature: await sign(
      encode({ targetPostID: postID, reason, evidence, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  // Announce report to DHT
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  await client.announce(`/isc/reports/${postID}`, encode(report), 86400);

  return report;
}

/**
 * Get reports for a post
 */
export async function getReports(postID: string): Promise<CommunityReport[]> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  
  const encoded = await client.query(`/isc/reports/${postID}`, 100);
  return encoded.map((d) => JSON.parse(d) as CommunityReport);
}

/**
 * Check if post should be hidden based on reports
 */
export async function shouldHidePost(
  postID: string,
  userReputation: number
): Promise<boolean> {
  const reports = await getReports(postID);
  
  // Count reports from high-reputation users
  let weightedReportCount = 0;
  for (const report of reports) {
    const reporterRep = await computeReputation(report.reporter);
    weightedReportCount += reporterRep.score;
  }

  // Hide if weighted report count exceeds threshold
  // Threshold decreases as user reputation increases
  const threshold = 3 - (userReputation * 0.5);
  return weightedReportCount >= threshold;
}

/**
 * Get moderation score for a post
 * Returns: -1 (hide), 0 (neutral), 1 (promote)
 */
export async function getModerationScore(
  post: SignedPost,
  channelID: string,
  userReputation: number
): Promise<number> {
  // Check coherence
  const coherence = await checkPostCoherence(post, channelID);
  
  // Check reports
  const reports = await getReports(post.postID);
  let reportScore = 0;
  
  for (const report of reports) {
    const reporterRep = await computeReputation(report.reporter);
    reportScore += reporterRep.score;
  }

  // Combine scores
  // Coherence contributes positively, reports negatively
  const finalScore = coherence - (reportScore * 0.2);

  if (finalScore < 0.3) return -1; // Hide
  if (finalScore > 0.8) return 1;  // Promote
  return 0; // Neutral
}

/**
 * Get muted peers from local storage
 */
export async function getMutedPeers(): Promise<string[]> {
  try {
    const db = await getIndexedDB();
    const muted = await db.transaction('mutes', 'readonly')
      .objectStore('mutes')
      .getAllKeys();
    return muted.map((k) => k as string);
  } catch {
    return [];
  }
}

/**
 * Mute a peer
 */
export async function mutePeer(peerID: string): Promise<void> {
  const db = await getIndexedDB();
  await db.transaction('mutes', 'readwrite')
    .objectStore('mutes')
    .put({ peerID, mutedAt: Date.now() });
}

/**
 * Unmute a peer
 */
export async function unmutePeer(peerID: string): Promise<void> {
  const db = await getIndexedDB();
  await db.transaction('mutes', 'readwrite')
    .objectStore('mutes')
    .delete(peerID);
}

/**
 * Filter posts by muted peers
 */
export function filterMutedPosts(
  posts: SignedPost[],
  mutedPeers: string[]
): SignedPost[] {
  const mutedSet = new Set(mutedPeers);
  return posts.filter((post) => !mutedSet.has(post.author));
}

/**
 * Get blocked peers from local storage
 */
export async function getBlockedPeers(): Promise<string[]> {
  try {
    const db = await getIndexedDB();
    const blocked = await db.transaction('blocks', 'readonly')
      .objectStore('blocks')
      .getAllKeys();
    return blocked.map((k) => k as string);
  } catch {
    return [];
  }
}

/**
 * Block a peer - prevents all interaction and content visibility
 * Stronger than mute - also prevents the blocked peer from interacting with you
 */
export async function blockPeer(peerID: string): Promise<BlockEvent> {
  const event: BlockEvent = {
    type: 'block',
    blocker: await getPeerID(),
    blocked: peerID,
    timestamp: Date.now(),
    signature: await sign(
      encode({ type: 'block', blocked: peerID, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  const db = await getIndexedDB();
  await db.transaction('blocks', 'readwrite')
    .objectStore('blocks')
    .put({
      peerID,
      blockedAt: Date.now(),
    });

  // Announce block to DHT for propagation
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  await client.announce(`/isc/block/${peerID}`, encode(event), 86400 * 30);

  return event;
}

/**
 * Unblock a peer
 */
export async function unblockPeer(peerID: string): Promise<void> {
  const db = await getIndexedDB();
  await db.transaction('blocks', 'readwrite')
    .objectStore('blocks')
    .delete(peerID);

  // Announce unblock
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  const event: BlockEvent = {
    type: 'unblock',
    blocker: await getPeerID(),
    blocked: peerID,
    timestamp: Date.now(),
    signature: await sign(
      encode({ type: 'unblock', blocked: peerID, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };
  await client.announce(`/isc/block/${peerID}`, encode(event), 86400);
}

/**
 * Filter posts by blocked peers (more aggressive than mute)
 */
export function filterBlockedPosts(
  posts: SignedPost[],
  blockedPeers: string[]
): SignedPost[] {
  const blockedSet = new Set(blockedPeers);
  return posts.filter((post) => !blockedSet.has(post.author));
}

/**
 * Check if peer is blocked or muted (combined check)
 */
export async function isPeerBlockedOrMuted(peerID: string): Promise<boolean> {
  const muted = await getMutedPeers();
  const blocked = await getBlockedPeers();
  return muted.includes(peerID) || blocked.includes(peerID);
}

// ============================================================================
// Decentralized Moderation - Community Councils
// ============================================================================

/** Default reputation threshold for council membership */
const COUNCIL_REP_THRESHOLD = 0.7;

/** Default voting threshold (majority) */
const DEFAULT_VOTING_THRESHOLD = 3;

/**
 * Create a new community council
 */
export async function createCouncil(
  name: string,
  jurisdiction: string[],
  members: string[]
): Promise<CommunityCouncil> {
  const council: CommunityCouncil = {
    id: `council_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    members,
    threshold: Math.ceil(members.length / 2) + 1, // Majority + 1
    jurisdiction,
    reputationThreshold: COUNCIL_REP_THRESHOLD,
  };

  // Store council definition
  const db = await getIndexedDB();
  await db.transaction('councils', 'readwrite')
    .objectStore('councils')
    .put(council);

  return council;
}

/**
 * Get council by ID
 */
export async function getCouncil(councilId: string): Promise<CommunityCouncil | null> {
  const db = await getIndexedDB();
  const council = await db.transaction('councils', 'readonly')
    .objectStore('councils')
    .get(councilId);
  return council || null;
}

/**
 * Get councils that have jurisdiction over a channel
 */
export async function getCouncilsForChannel(channelID: string): Promise<CommunityCouncil[]> {
  const db = await getIndexedDB();
  const councils = await db.transaction('councils', 'readonly')
    .objectStore('councils')
    .getAll();

  return councils.filter((c) => c.jurisdiction.includes(channelID) || c.jurisdiction.includes('*'));
}

/**
 * Submit a moderation vote to a council
 */
export async function submitModerationVote(
  councilId: string,
  reportId: string,
  decision: ModerationVote['decision'],
  reasoning: string
): Promise<ModerationVote> {
  const council = await getCouncil(councilId);
  if (!council) throw new Error(`Council ${councilId} not found`);

  const myPeer = await getPeerID();
  if (!council.members.includes(myPeer)) {
    throw new Error('Not a council member');
  }

  const rep = await computeReputation(myPeer);
  if (rep.score < council.reputationThreshold) {
    throw new Error('Insufficient reputation for council voting');
  }

  const vote: ModerationVote = {
    councilId,
    reportId,
    voter: myPeer,
    decision,
    reasoning,
    timestamp: Date.now(),
    signature: await sign(
      encode({ councilId, reportId, decision, reasoning, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  // Store vote
  const db = await getIndexedDB();
  await db.transaction('votes', 'readwrite')
    .objectStore('votes')
    .put(vote);

  return vote;
}

/**
 * Get all votes for a report
 */
export async function getVotesForReport(reportId: string): Promise<ModerationVote[]> {
  const db = await getIndexedDB();
  const votes = await db.transaction('votes', 'readonly')
    .objectStore('votes')
    .getAll();

  return votes.filter((v) => v.reportId === reportId);
}

/**
 * Process moderation decision based on votes
 * Returns decision if threshold is met, null otherwise
 */
export async function processModerationDecision(
  reportId: string,
  councilId: string
): Promise<ModerationDecision | null> {
  const council = await getCouncil(councilId);
  if (!council) return null;

  const votes = await getVotesForReport(reportId);
  const approveCount = votes.filter((v) => v.decision === 'approve').length;
  const rejectCount = votes.filter((v) => v.decision === 'reject').length;
  const dismissCount = votes.filter((v) => v.decision === 'dismiss').length;

  // Check if threshold is met
  if (approveCount >= council.threshold) {
    return {
      reportId,
      outcome: 'hidden',
      votes,
      decidedBy: votes[0]?.voter || '',
      timestamp: Date.now(),
    };
  }

  if (rejectCount >= council.threshold || dismissCount >= council.threshold) {
    return {
      reportId,
      outcome: 'restored',
      votes,
      decidedBy: votes[0]?.voter || '',
      timestamp: Date.now(),
    };
  }

  // Threshold not met yet
  return null;
}

/**
 * Escalate a report to a higher-level council
 */
export async function escalateReport(
  reportId: string,
  fromCouncilId: string,
  toCouncilId: string
): Promise<void> {
  const fromCouncil = await getCouncil(fromCouncilId);
  const toCouncil = await getCouncil(toCouncilId);

  if (!fromCouncil || !toCouncil) {
    throw new Error('Invalid council IDs');
  }

  // Create escalation record
  const db = await getIndexedDB();
  await db.transaction('escalations', 'readwrite')
    .objectStore('escalations')
    .put({
      reportId,
      fromCouncilId,
      toCouncilId,
      escalatedAt: Date.now(),
      escalatedBy: await getPeerID(),
    });
}

/**
 * Get council member eligibility (peers who could join)
 */
export async function getCouncilEligibleMembers(
  councilId: string
): Promise<{ peerID: string; reputation: number }[]> {
  const council = await getCouncil(councilId);
  if (!council) return [];

  const candidates = await getAllKnownPeers();
  const eligible: { peerID: string; reputation: number }[] = [];

  for (const peerID of candidates) {
    if (council.members.includes(peerID)) continue;

    const rep = await computeReputation(peerID);
    if (rep.score >= council.reputationThreshold) {
      eligible.push({ peerID, reputation: rep.score });
    }
  }

  return eligible.sort((a, b) => b.reputation - a.reputation);
}

// IndexedDB helper
async function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-social', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create mutes store if not exists
      if (!db.objectStoreNames.contains('mutes')) {
        db.createObjectStore('mutes', { keyPath: 'peerID' });
      }

      // Create blocks store if not exists
      if (!db.objectStoreNames.contains('blocks')) {
        db.createObjectStore('blocks', { keyPath: 'peerID' });
      }

      // Create councils store if not exists
      if (!db.objectStoreNames.contains('councils')) {
        db.createObjectStore('councils', { keyPath: 'id' });
      }

      // Create votes store if not exists
      if (!db.objectStoreNames.contains('votes')) {
        db.createObjectStore('votes', { keyPath: 'councilId' });
      }

      // Create escalations store if not exists
      if (!db.objectStoreNames.contains('escalations')) {
        db.createObjectStore('escalations', { keyPath: 'reportId' });
      }

      // Create interactions store if not exists
      if (!db.objectStoreNames.contains('interactions')) {
        db.createObjectStore('interactions', { keyPath: ['peerID', 'timestamp'] });
      }
    };
  });
}

function encode(data: unknown): string {
  return JSON.stringify(data);
}
