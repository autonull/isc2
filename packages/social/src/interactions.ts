/**
 * Interactions Service
 *
 * Manages post interactions: likes, reposts, replies, quotes.
 * Storage and network are injected via adapters.
 */

import type { SocialStorage, SocialIdentity, SocialNetwork } from './adapters/interfaces';

export interface LikeEvent {
  id: string;
  liker: string;
  postID: string;
  timestamp: number;
  signature?: Uint8Array;
}

export interface RepostEvent {
  id: string;
  reposter: string;
  postID: string;
  timestamp: number;
  signature?: Uint8Array;
}

export interface ReplyEvent {
  id: string;
  parentID: string;
  author: string;
  content: string;
  channelID: string;
  timestamp: number;
  signature?: Uint8Array;
}

export interface QuoteEvent {
  id: string;
  quoter: string;
  postID: string;
  content: string;
  channelID: string;
  timestamp: number;
  signature?: Uint8Array;
}

export interface InteractionCounts {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

export interface InteractionService {
  likePost(postID: string): Promise<LikeEvent>;
  unlikePost(postID: string): Promise<void>;
  getLikeCount(postID: string): Promise<number>;
  hasLiked(postID: string): Promise<boolean>;

  repostPost(postID: string): Promise<RepostEvent>;
  getRepostCount(postID: string): Promise<number>;

  replyToPost(parentID: string, content: string, channelID: string): Promise<ReplyEvent>;
  getReplies(parentID: string): Promise<ReplyEvent[]>;
  getReplyCount(parentID: string): Promise<number>;

  quotePost(postID: string, content: string, channelID: string): Promise<QuoteEvent>;
  getQuoteCount(postID: string): Promise<number>;

  getInteractionCounts(postID: string): Promise<InteractionCounts>;
}

export function createInteractionService(
  storage: SocialStorage,
  identity: SocialIdentity,
  network?: SocialNetwork
): InteractionService {
  const LIKES_STORE = 'likes';
  const REPOSTS_STORE = 'reposts';
  const REPLIES_STORE = 'replies';
  const QUOTES_STORE = 'quotes';
  const DEFAULT_TTL = 86400 * 30;

  async function createAndAnnounceEvent<T extends { id: string }>(
    payload: T,
    dhtKey: string,
    store: string
  ): Promise<T> {
    // Save locally
    await storage.saveInteraction({
      id: payload.id,
      peerID: 'postID' in payload ? (payload as any).postID : 'unknown',
      type: store.slice(0, -1), // Remove trailing 's'
      timestamp: (payload as any).timestamp,
      weight: 1,
    });

    // Announce to network if available
    if (network) {
      try {
        await network.broadcastPost({
          id: payload.id,
          author: 'unknown',
          content: JSON.stringify(payload),
          channelID: 'unknown',
          timestamp: (payload as any).timestamp,
          signature: new Uint8Array(),
        });
      } catch (error) {
        // Log error but don't fail
        console.warn('Failed to announce event to network', error);
      }
    }

    return payload;
  }

  return {
    async likePost(postID: string): Promise<LikeEvent> {
      const liker = await identity.getPeerId();
      const like: LikeEvent = {
        id: `like_${crypto.randomUUID()}`,
        liker,
        postID,
        timestamp: Date.now(),
      };

      return createAndAnnounceEvent(like, `/isc/like/${postID}/${liker}`, LIKES_STORE);
    },

    async unlikePost(postID: string): Promise<void> {
      const liker = await identity.getPeerId();
      const likes = await storage.getInteractions(postID);
      for (const like of likes.filter((l) => l.peerID === liker && l.type === 'like')) {
        await storage.deleteInteraction(like.id);
      }
    },

    async getLikeCount(postID: string): Promise<number> {
      const likes = await storage.getInteractions(postID);
      return likes.filter((l) => l.type === 'like').length;
    },

    async hasLiked(postID: string): Promise<boolean> {
      const liker = await identity.getPeerId();
      const likes = await storage.getInteractions(postID);
      return likes.some((l) => l.type === 'like' && l.peerID === liker);
    },

    async repostPost(postID: string): Promise<RepostEvent> {
      const reposter = await identity.getPeerId();
      const repost: RepostEvent = {
        id: `repost_${crypto.randomUUID()}`,
        reposter,
        postID,
        timestamp: Date.now(),
      };

      return createAndAnnounceEvent(repost, `/isc/repost/${postID}/${reposter}`, REPOSTS_STORE);
    },

    async getRepostCount(postID: string): Promise<number> {
      const reposts = await storage.getInteractions(postID);
      return reposts.filter((r) => r.type === 'repost').length;
    },

    async replyToPost(parentID: string, content: string, channelID: string): Promise<ReplyEvent> {
      const author = await identity.getPeerId();
      const reply: ReplyEvent = {
        id: `reply_${crypto.randomUUID()}`,
        parentID,
        author,
        content,
        channelID,
        timestamp: Date.now(),
      };

      return createAndAnnounceEvent(reply, `/isc/reply/${parentID}/${author}`, REPLIES_STORE);
    },

    async getReplies(parentID: string): Promise<ReplyEvent[]> {
      const replies = await storage.getInteractions(parentID);
      return replies.filter((r) => r.type === 'reply') as any[];
    },

    async getReplyCount(parentID: string): Promise<number> {
      const replies = await storage.getInteractions(parentID);
      return replies.filter((r) => r.type === 'reply').length;
    },

    async quotePost(postID: string, content: string, channelID: string): Promise<QuoteEvent> {
      const quoter = await identity.getPeerId();
      const quote: QuoteEvent = {
        id: `quote_${crypto.randomUUID()}`,
        quoter,
        postID,
        content,
        channelID,
        timestamp: Date.now(),
      };

      return createAndAnnounceEvent(quote, `/isc/quote/${postID}/${quoter}`, QUOTES_STORE);
    },

    async getQuoteCount(postID: string): Promise<number> {
      const quotes = await storage.getInteractions(postID);
      return quotes.filter((q) => q.type === 'quote').length;
    },

    async getInteractionCounts(postID: string): Promise<InteractionCounts> {
      const [likes, reposts, replies, quotes] = await Promise.all([
        this.getLikeCount(postID),
        this.getRepostCount(postID),
        this.getReplyCount(postID),
        this.getQuoteCount(postID),
      ]);

      return { likes, reposts, replies, quotes };
    },
  };
}
