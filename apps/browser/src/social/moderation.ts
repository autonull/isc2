/**
 * Content Moderation Service
 * 
 * Handles semantic moderation, reports, and reputation-based filtering.
 * References: SOCIAL.md#semantic-moderation
 */

import { cosineSimilarity } from '@isc/core/math';
import type { SignedPost, ChannelSummary, CommunityReport, ReputationScore } from './types';
import { getChannel } from '../channels/manager';
import { computeReputation } from './graph';

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

// IndexedDB helper
async function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-social', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('mutes')) {
        db.createObjectStore('mutes', { keyPath: 'peerID' });
      }
    };
  });
}

function encode(data: unknown): string {
  return JSON.stringify(data);
}
