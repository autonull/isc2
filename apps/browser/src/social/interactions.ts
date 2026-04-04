/**
 * Interactions Module - Backward compatibility wrapper
 *
 * Re-exports from @isc/social/interactions with browser-specific wrappers.
 */

export {
  type InteractionService,
  type LikeEvent,
  type RepostEvent,
  type ReplyEvent,
  type QuoteEvent,
  type InteractionCounts,
} from '@isc/social';

import { createInteractionService, type InteractionService, type LikeEvent, type RepostEvent, type ReplyEvent, type QuoteEvent } from '@isc/social';
import { browserStorageAdapter } from './adapters/storage.js';
import { browserIdentityAdapter } from './adapters/identity.js';
import { browserNetworkAdapter } from './adapters/network.js';

// Lazy-loaded interaction service singleton
let interactionService: InteractionService | null = null;

async function getInteractionSvc(): Promise<InteractionService> {
  if (!interactionService) {
    interactionService = createInteractionService(browserStorageAdapter, browserIdentityAdapter, browserNetworkAdapter);
  }
  return interactionService;
}

// Backward-compatible function exports
export async function likePost(postID: string): Promise<LikeEvent> {
  const svc = await getInteractionSvc();
  return svc.likePost(postID);
}

export async function unlikePost(postID: string): Promise<void> {
  const svc = await getInteractionSvc();
  return svc.unlikePost(postID);
}

export async function getLikeCount(postID: string): Promise<number> {
  const svc = await getInteractionSvc();
  return svc.getLikeCount(postID);
}

export async function hasLiked(postID: string): Promise<boolean> {
  const svc = await getInteractionSvc();
  return svc.hasLiked(postID);
}

export async function repostPost(postID: string): Promise<RepostEvent> {
  const svc = await getInteractionSvc();
  return svc.repostPost(postID);
}

export async function getRepostCount(postID: string): Promise<number> {
  const svc = await getInteractionSvc();
  return svc.getRepostCount(postID);
}

export async function replyToPost(parentID: string, content: string, channelID: string): Promise<ReplyEvent> {
  const svc = await getInteractionSvc();
  return svc.replyToPost(parentID, content, channelID);
}

export async function getReplies(parentID: string): Promise<ReplyEvent[]> {
  const svc = await getInteractionSvc();
  return svc.getReplies(parentID);
}

export async function getReplyCount(parentID: string): Promise<number> {
  const svc = await getInteractionSvc();
  return svc.getReplyCount(parentID);
}

export async function quotePost(postID: string, content: string, channelID: string): Promise<QuoteEvent> {
  const svc = await getInteractionSvc();
  return svc.quotePost(postID, content, channelID);
}

export async function getQuoteCount(postID: string): Promise<number> {
  const svc = await getInteractionSvc();
  return svc.getQuoteCount(postID);
}

export async function getInteractionCounts(postID: string): Promise<import('@isc/social').InteractionCounts> {
  const svc = await getInteractionSvc();
  return svc.getInteractionCounts(postID);
}
