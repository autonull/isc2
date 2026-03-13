import { sign, encode, type Signature } from '@isc/core';
import type { LikeEvent, RepostEvent, ReplyEvent, QuoteEvent } from './types.js';
import { getPeerID, getKeypair } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbGetAll, dbPut, dbDelete, dbFilter } from '../db/helpers.js';
import { signContent, announceToDHT } from './signing.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.social;

const LIKES_STORE = 'likes';
const REPOSTS_STORE = 'reposts';
const REPLIES_STORE = 'replies';
const QUOTES_STORE = 'quotes';
const DEFAULT_TTL = 86400 * 30;

async function createAndAnnounceEvent<T extends { id: string; signature: Signature }>(
  payload: Omit<T, 'signature'>,
  store: string,
  dhtKey: string
): Promise<T> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const signature = await sign(encode(payload), keypair.privateKey);
  const event = { ...payload, signature } as T;

  await dbPut(store, event);

  try {
    await announceToDHT(dhtKey, event);
  } catch (error) {
    logger.warn('Failed to announce event to DHT', { error: (error as Error).message, dhtKey });
  }

  return event;
}

export async function likePost(postID: string): Promise<LikeEvent> {
  const liker = await getPeerID();

  return createAndAnnounceEvent<LikeEvent>(
    {
      id: `like_${crypto.randomUUID()}`,
      liker,
      postID,
      timestamp: Date.now(),
    },
    LIKES_STORE,
    `/isc/like/${postID}/${liker}`
  );
}

export async function unlikePost(postID: string): Promise<void> {
  const liker = await getPeerID();
  const likes = await dbFilter<LikeEvent>(LIKES_STORE, (like) =>
    like.postID === postID && like.liker === liker
  );

  for (const like of likes) {
    await dbDelete(LIKES_STORE, like.id);
  }
}

export async function getLikeCount(postID: string): Promise<number> {
  const likes = await dbFilter<LikeEvent>(LIKES_STORE, (like) => like.postID === postID);
  return likes.length;
}

export async function hasLiked(postID: string): Promise<boolean> {
  const liker = await getPeerID();
  const likes = await dbFilter<LikeEvent>(LIKES_STORE, (like) =>
    like.postID === postID && like.liker === liker
  );
  return likes.length > 0;
}

export async function repostPost(postID: string): Promise<RepostEvent> {
  const reposter = await getPeerID();

  return createAndAnnounceEvent<RepostEvent>(
    {
      id: `repost_${crypto.randomUUID()}`,
      reposter,
      postID,
      timestamp: Date.now(),
    },
    REPOSTS_STORE,
    `/isc/repost/${postID}/${reposter}`
  );
}

export async function replyToPost(
  parentID: string,
  content: string,
  channelID: string
): Promise<ReplyEvent> {
  const author = await getPeerID();

  return createAndAnnounceEvent<ReplyEvent>(
    {
      id: `reply_${crypto.randomUUID()}`,
      parentID,
      author,
      content,
      channelID,
      timestamp: Date.now(),
    },
    REPLIES_STORE,
    `/isc/reply/${parentID}/${author}`
  );
}

export async function getReplies(parentID: string): Promise<ReplyEvent[]> {
  return dbFilter<ReplyEvent>(REPLIES_STORE, (reply) => reply.parentID === parentID);
}

export async function quotePost(
  postID: string,
  content: string,
  channelID: string
): Promise<QuoteEvent> {
  const quoter = await getPeerID();

  return createAndAnnounceEvent<QuoteEvent>(
    {
      id: `quote_${crypto.randomUUID()}`,
      quoter,
      postID,
      content,
      channelID,
      timestamp: Date.now(),
    },
    QUOTES_STORE,
    `/isc/quote/${postID}/${quoter}`
  );
}

export async function getInteractionCounts(postID: string): Promise<{
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}> {
  const [likes, reposts, replies, quotes] = await Promise.all([
    getLikeCount(postID),
    getRepostCount(postID),
    getReplyCount(postID),
    getQuoteCount(postID),
  ]);

  return { likes, reposts, replies, quotes };
}

async function getRepostCount(postID: string): Promise<number> {
  const reposts = await dbFilter<RepostEvent>(REPOSTS_STORE, (repost) => repost.postID === postID);
  return reposts.length;
}

async function getReplyCount(parentID: string): Promise<number> {
  const replies = await dbFilter<ReplyEvent>(REPLIES_STORE, (reply) => reply.parentID === parentID);
  return replies.length;
}

async function getQuoteCount(postID: string): Promise<number> {
  const quotes = await dbFilter<QuoteEvent>(QUOTES_STORE, (quote) => quote.postID === postID);
  return quotes.length;
}
