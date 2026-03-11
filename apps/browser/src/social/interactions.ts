/**
 * Interactions Service
 * 
 * Handles likes, reposts, replies, and quotes.
 * References: SOCIAL.md#interactions
 */

import { sign, encode } from '@isc/core/crypto';
import { lshHash } from '@isc/core/math';
import type { 
  LikeEvent, 
  RepostEvent, 
  ReplyEvent, 
  QuoteEvent,
  SignedPost 
} from './types';
import { getPeerID, getKeypair } from '../identity';
import { loadEmbeddingModel } from '../identity/embedding';
import { getChannel } from '../channels/manager';

/** Default TTL for interactions (24 hours) */
const DEFAULT_TTL = 86400;

/**
 * Like a post
 */
export async function likePost(postID: string): Promise<LikeEvent> {
  const event: LikeEvent = {
    type: 'like',
    reactor: await getPeerID(),
    targetPostID: postID,
    timestamp: Date.now(),
    signature: await sign(
      encode({ type: 'like', targetPostID: postID, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  await announceInteraction(`/isc/likes/${postID}`, event);
  return event;
}

/**
 * Repost a post with reposter's semantic distribution
 */
export async function repostPost(
  postID: string,
  channelID: string
): Promise<RepostEvent> {
  const channel = await getChannel(channelID);
  const embedding = channel?.distributions[0]?.mu ?? [];

  const event: RepostEvent = {
    type: 'repost',
    reactor: await getPeerID(),
    targetPostID: postID,
    channelID,
    embedding,
    timestamp: Date.now(),
    signature: await sign(
      encode({ type: 'repost', targetPostID: postID, channelID, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  // Announce under reposter's channel for hybrid reach
  await announceInteraction(`/isc/reposts/${postID}`, event);
  
  // Also re-announce original post under reposter's semantic bucket
  if (embedding.length > 0) {
    const hashes = lshHash(embedding, 'default-384', 3);
    const { DelegationClient } = await import('../delegation/fallback');
    const client = DelegationClient.getInstance();
    
    for (const hash of hashes) {
      const key = `/isc/post/default-384/${hash}`;
      const repostKey = `/isc/repost/${postID}/${hash}`;
      await client.announce(repostKey, encode(event), DEFAULT_TTL);
    }
  }

  return event;
}

/**
 * Reply to a post
 */
export async function replyToPost(
  postID: string,
  content: string
): Promise<ReplyEvent> {
  const model = await loadEmbeddingModel();
  const embedding = await model.embed(content);

  const event: ReplyEvent = {
    type: 'reply',
    reactor: await getPeerID(),
    targetPostID: postID,
    content,
    embedding,
    timestamp: Date.now(),
    signature: await sign(
      encode({ type: 'reply', targetPostID: postID, content, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  await announceInteraction(`/isc/replies/${postID}`, event);
  return event;
}

/**
 * Quote a post with commentary
 */
export async function quotePost(
  postID: string,
  originalContent: string,
  commentary: string
): Promise<QuoteEvent> {
  const model = await loadEmbeddingModel();
  const fusedEmbedding = await model.embed(`${originalContent} ${commentary}`);

  const event: QuoteEvent = {
    type: 'quote',
    reactor: await getPeerID(),
    targetPostID: postID,
    originalContent,
    commentary,
    fusedEmbedding,
    timestamp: Date.now(),
    signature: await sign(
      encode({ type: 'quote', targetPostID: postID, commentary, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  await announceInteraction(`/isc/quotes/${postID}`, event);
  return event;
}

/**
 * Compute engagement score for a post
 */
export async function computeEngagementScore(postID: string): Promise<number> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();

  const [likes, reposts, replies] = await Promise.all([
    client.query(`/isc/likes/${postID}`, 1000),
    client.query(`/isc/reposts/${postID}`, 1000),
    client.query(`/isc/replies/${postID}`, 1000),
  ]);

  // Weighted score: replies > reposts > likes
  return replies.length * 3 + reposts.length * 2 + likes.length;
}

/**
 * Get replies for a post
 */
export async function getReplies(postID: string): Promise<ReplyEvent[]> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();

  const encoded = await client.query(`/isc/replies/${postID}`, 100);
  return encoded.map((d) => JSON.parse(d) as ReplyEvent);
}

/**
 * Get like count for a post
 */
export async function getLikeCount(postID: string): Promise<number> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();

  const encoded = await client.query(`/isc/likes/${postID}`, 1000);
  return encoded.length;
}

/**
 * Get repost count for a post
 */
export async function getRepostCount(postID: string): Promise<number> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();

  const encoded = await client.query(`/isc/reposts/${postID}`, 1000);
  return encoded.length;
}

/**
 * Announce interaction to DHT
 */
async function announceInteraction(key: string, event: unknown): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  await client.announce(key, encode(event), DEFAULT_TTL);
}

function encode(data: unknown): string {
  return JSON.stringify(data);
}
