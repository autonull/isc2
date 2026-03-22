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

import { createInteractionService } from '@isc/social';
import { browserStorageAdapter } from './adapters/storage.js';
import { browserIdentityAdapter } from './adapters/identity.js';
import { browserNetworkAdapter } from './adapters/network.js';

// Lazy-loaded interaction service singleton
let interactionService: any = null;

async function getInteractionService() {
  if (!interactionService) {
    interactionService = createInteractionService(browserStorageAdapter, browserIdentityAdapter, browserNetworkAdapter);
  }
  return interactionService;
}

// Backward-compatible function exports
export async function likePost(postID: string): Promise<any> {
  const svc = await getInteractionService();
  return svc.likePost(postID);
}

export async function unlikePost(postID: string): Promise<void> {
  const svc = await getInteractionService();
  return svc.unlikePost(postID);
}

export async function getLikeCount(postID: string): Promise<number> {
  const svc = await getInteractionService();
  return svc.getLikeCount(postID);
}

export async function hasLiked(postID: string): Promise<boolean> {
  const svc = await getInteractionService();
  return svc.hasLiked(postID);
}

export async function repostPost(postID: string): Promise<any> {
  const svc = await getInteractionService();
  return svc.repostPost(postID);
}

export async function getRepostCount(postID: string): Promise<number> {
  const svc = await getInteractionService();
  return svc.getRepostCount(postID);
}

export async function replyToPost(parentID: string, content: string, channelID: string): Promise<any> {
  const svc = await getInteractionService();
  return svc.replyToPost(parentID, content, channelID);
}

export async function getReplies(parentID: string): Promise<any[]> {
  const svc = await getInteractionService();
  return svc.getReplies(parentID);
}

export async function getReplyCount(parentID: string): Promise<number> {
  const svc = await getInteractionService();
  return svc.getReplyCount(parentID);
}

export async function quotePost(postID: string, content: string, channelID: string): Promise<any> {
  const svc = await getInteractionService();
  return svc.quotePost(postID, content, channelID);
}

export async function getQuoteCount(postID: string): Promise<number> {
  const svc = await getInteractionService();
  return svc.getQuoteCount(postID);
}

export async function getInteractionCounts(postID: string): Promise<any> {
  const svc = await getInteractionService();
  return svc.getInteractionCounts(postID);
}
