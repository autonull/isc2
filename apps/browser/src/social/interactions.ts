import { sign, encode } from '@isc/core';
import type { LikeEvent, RepostEvent, ReplyEvent, QuoteEvent } from './types.js';
import { getPeerID, getKeypair } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbGetAll, dbPut, dbDelete, dbFilter } from '../db/helpers.js';

const LIKES_STORE = 'likes';
const REPOSTS_STORE = 'reposts';
const REPLIES_STORE = 'replies';
const QUOTES_STORE = 'quotes';
const DEFAULT_TTL = 86400 * 30;

export async function likePost(postID: string): Promise<LikeEvent> {
  const liker = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) throw new Error('Identity not initialized');

  const like: Omit<LikeEvent, 'signature'> = {
    id: `like_${crypto.randomUUID()}`,
    liker,
    postID,
    timestamp: Date.now(),
  };

  const payload = encode(like);
  const signature = await sign(payload, keypair.privateKey);
  const signedLike: LikeEvent = { ...like, signature };

  await dbPut(LIKES_STORE, signedLike);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/like/${postID}/${liker}`;
    await client.announce(key, encode(signedLike), DEFAULT_TTL);
  }

  return signedLike;
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
  const keypair = getKeypair();

  if (!keypair) throw new Error('Identity not initialized');

  const repost: Omit<RepostEvent, 'signature'> = {
    id: `repost_${crypto.randomUUID()}`,
    reposter,
    postID,
    timestamp: Date.now(),
  };

  const payload = encode(repost);
  const signature = await sign(payload, keypair.privateKey);
  const signedRepost: RepostEvent = { ...repost, signature };

  await dbPut(REPOSTS_STORE, signedRepost);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/repost/${postID}/${reposter}`;
    await client.announce(key, encode(signedRepost), DEFAULT_TTL);
  }

  return signedRepost;
}

export async function replyToPost(
  parentID: string,
  content: string,
  channelID: string
): Promise<ReplyEvent> {
  const author = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) throw new Error('Identity not initialized');

  const reply: Omit<ReplyEvent, 'signature'> = {
    id: `reply_${crypto.randomUUID()}`,
    parentID,
    author,
    content,
    channelID,
    timestamp: Date.now(),
  };

  const payload = encode(reply);
  const signature = await sign(payload, keypair.privateKey);
  const signedReply: ReplyEvent = { ...reply, signature };

  await dbPut(REPLIES_STORE, signedReply);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/reply/${parentID}/${signedReply.id}`;
    await client.announce(key, encode(signedReply), DEFAULT_TTL);
  }

  return signedReply;
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
  const keypair = getKeypair();

  if (!keypair) throw new Error('Identity not initialized');

  const quote: Omit<QuoteEvent, 'signature'> = {
    id: `quote_${crypto.randomUUID()}`,
    quoter,
    postID,
    content,
    channelID,
    timestamp: Date.now(),
  };

  const payload = encode(quote);
  const signature = await sign(payload, keypair.privateKey);
  const signedQuote: QuoteEvent = { ...quote, signature };

  await dbPut(QUOTES_STORE, signedQuote);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/quote/${postID}/${quoter}`;
    await client.announce(key, encode(signedQuote), DEFAULT_TTL);
  }

  return signedQuote;
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
