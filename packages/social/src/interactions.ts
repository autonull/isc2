/* eslint-disable */
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
  const getCountByType = async (postID: string, type: string): Promise<number> => {
    const interactions = await storage.getInteractions(postID);
    return interactions.filter((i) => i.type === type).length;
  };

  const service: InteractionService = {
    async likePost(postID: string): Promise<LikeEvent> {
      const liker = await identity.getPeerId();
      const like: LikeEvent = {
        id: `like_${crypto.randomUUID()}`,
        liker,
        postID,
        timestamp: Date.now(),
      };

      await storage.saveInteraction({
        id: like.id,
        peerID: postID,
        type: 'like',
        timestamp: like.timestamp,
        weight: 1,
      });

      if (network) {
        network.broadcastPost({
          id: like.id,
          author: liker,
          content: `liked ${postID}`,
          channelID: 'system',
          timestamp: like.timestamp,
          signature: new Uint8Array(),
        }).catch(() => {});
      }

      return like;
    },

    async unlikePost(postID: string): Promise<void> {
      const liker = await identity.getPeerId();
      const interactions = await storage.getInteractions(postID);
      for (const i of interactions.filter((i) => i.type === 'like' && i.peerID === liker)) {
        await storage.deleteInteraction(i.id);
      }
    },

    async getLikeCount(postID: string): Promise<number> {
      return getCountByType(postID, 'like');
    },

    async hasLiked(postID: string): Promise<boolean> {
      const liker = await identity.getPeerId();
      const interactions = await storage.getInteractions(postID);
      return interactions.some((i) => i.type === 'like' && i.peerID === liker);
    },

    async repostPost(postID: string): Promise<RepostEvent> {
      const reposter = await identity.getPeerId();
      const repost: RepostEvent = {
        id: `repost_${crypto.randomUUID()}`,
        reposter,
        postID,
        timestamp: Date.now(),
      };

      await storage.saveInteraction({
        id: repost.id,
        peerID: postID,
        type: 'repost',
        timestamp: repost.timestamp,
        weight: 1,
      });

      return repost;
    },

    async getRepostCount(postID: string): Promise<number> {
      return getCountByType(postID, 'repost');
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

      await storage.saveInteraction({
        id: reply.id,
        peerID: parentID,
        type: 'reply',
        timestamp: reply.timestamp,
        weight: 1,
      });

      return reply;
    },

    async getReplies(parentID: string): Promise<ReplyEvent[]> {
      const interactions = await storage.getInteractions(parentID);
      return interactions.filter((i) => i.type === 'reply') as unknown as ReplyEvent[];
    },

    async getReplyCount(parentID: string): Promise<number> {
      return getCountByType(parentID, 'reply');
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

      await storage.saveInteraction({
        id: quote.id,
        peerID: postID,
        type: 'quote',
        timestamp: quote.timestamp,
        weight: 1,
      });

      return quote;
    },

    async getQuoteCount(postID: string): Promise<number> {
      return getCountByType(postID, 'quote');
    },

    async getInteractionCounts(postID: string): Promise<InteractionCounts> {
      const interactions = await storage.getInteractions(postID);
      return {
        likes: interactions.filter((i) => i.type === 'like').length,
        reposts: interactions.filter((i) => i.type === 'repost').length,
        replies: interactions.filter((i) => i.type === 'reply').length,
        quotes: interactions.filter((i) => i.type === 'quote').length,
      };
    },
  };

  return service;
}
