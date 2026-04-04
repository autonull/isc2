/* eslint-disable */
/**
 * Thought Bridge Service
 * 
 * Conversation starters and crossover word detection.
 * References: SOCIAL.md#thought-bridge
 */

import { cosineSimilarity } from '@isc/core';
import { getAllPosts } from './posts';
import { getChannel } from '../channels/manager';
import type { SignedPost } from './types';

/**
 * Find crossover words between two texts
 * Words that appear in both semantic contexts
 */
export function findCrossoverWords(text1: string, text2: string): string[] {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);
  
  // Find common words (excluding stop words)
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
    'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'as',
    'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its',
    'of', 'on', 'or', 'that', 'the', 'to', 'was', 'will', 'with',
  ]);
  
  const wordSet1 = new Set(words1.filter(w => !stopWords.has(w.toLowerCase())));
  const wordSet2 = new Set(words2.filter(w => !stopWords.has(w.toLowerCase())));
  
  const crossover = Array.from(wordSet1).filter(w => wordSet2.has(w));
  return crossover.slice(0, 10);
}

/**
 * Generate conversation starter based on two posts
 */
export async function generateConversationStarter(
  post1: SignedPost,
  post2: SignedPost
): Promise<string> {
  const crossover = findCrossoverWords(post1.content, post2.content);

  // Compute semantic similarity
  const emb1 = post1.embedding ?? [];
  const emb2 = post2.embedding ?? [];
  const similarity = cosineSimilarity(emb1, emb2);

  if (similarity > 0.8) {
    // Very similar - suggest agreement/building
    return `Both posts discuss ${crossover[0] || 'this topic'} from similar angles. How might you synthesize these perspectives?`;
  } else if (similarity > 0.5) {
    // Moderately similar - suggest connection
    return `These posts share themes of ${crossover.slice(0, 3).join(', ')}. What connections do you see between them?`;
  } else {
    // Divergent - suggest bridge
    return `These posts seem different but both touch on ${crossover[0] || 'important ideas'}. How might they inform each other?`;
  }
}

/**
 * Find conversation starters for a channel
 */
export async function getConversationStarters(
  channelID: string,
  limit: number = 5
): Promise<ConversationStarter[]> {
  const channel = await getChannel(channelID);
  if (!channel) return [];

  // Get posts from the channel
  const allPosts = await getAllPosts();
  const posts = allPosts.filter(p => p.channelID === channelID).slice(0, 50);
  if (posts.length < 2) return [];

  // Find pairs with moderate similarity (good for discussion)
  const starters: ConversationStarter[] = [];
  for (let i = 0; i < Math.min(posts.length, 20); i++) {
    for (let j = i + 1; j < Math.min(posts.length, 20); j++) {
      const embI = posts[i].embedding ?? [];
      const embJ = posts[j].embedding ?? [];

      const sim = cosineSimilarity(embI, embJ);
      if (sim > 0.4 && sim < 0.8) {
        const starter = await generateConversationStarter(posts[i], posts[j]);
        starters.push({
          id: `${posts[i].id}-${posts[j].id}`,
          starter,
          post1: posts[i],
          post2: posts[j],
          similarity: sim,
        });
      }
    }
  }

  // Sort by similarity (middle range is best)
  starters.sort((a, b) => {
    const aScore = Math.abs(a.similarity - 0.6);
    const bScore = Math.abs(b.similarity - 0.6);
    return aScore - bScore;
  });
  
  return starters.slice(0, limit);
}

/**
 * Find bridging posts that connect different topics
 */
export async function findBridgingPosts(
  channelID1: string,
  channelID2: string
): Promise<SignedPost[]> {
  const channel1 = await getChannel(channelID1);
  const channel2 = await getChannel(channelID2);

  if (!channel1 || !channel2) return [];

  const emb1 = channel1.distributions?.[0]?.mu ?? [];
  const emb2 = channel2.distributions?.[0]?.mu ?? [];

  // Get all posts and filter by similarity to both channels
  const allPosts = await getAllPosts();
  
  // Filter to posts that have moderate similarity to both
  return allPosts.filter((post: SignedPost) => {
    const postEmb = post.embedding ?? [];
    const sim1 = cosineSimilarity(emb1, postEmb);
    const sim2 = cosineSimilarity(emb2, postEmb);
    return sim1 > 0.4 && sim2 > 0.4;
  }).slice(0, 20);
}

/**
 * Suggest discussion topics based on channel divergence
 */
export async function suggestDiscussionTopics(
  channelIDs: string[]
): Promise<DiscussionTopic[]> {
  const channelResults = await Promise.all(channelIDs.map(id => getChannel(id)));
  const validChannels = channelResults.filter((c): c is Awaited<ReturnType<typeof getChannel>> & NonNullable<unknown> => c !== null);

  if (validChannels.length < 2) return [];

  // Find channels with moderate divergence
  const topics: DiscussionTopic[] = [];
  for (let i = 0; i < validChannels.length; i++) {
    for (let j = i + 1; j < validChannels.length; j++) {
      const chI = validChannels[i];
      const chJ = validChannels[j];
      
      if (!chI || !chJ) continue;

      const embI = chI.distributions?.[0]?.mu ?? [];
      const embJ = chJ.distributions?.[0]?.mu ?? [];
      
      const sim = cosineSimilarity(embI, embJ);

      if (sim > 0.3 && sim < 0.7) {
        const crossover = findCrossoverWords(
          chI.description ?? '',
          chJ.description ?? ''
        );

        topics.push({
          id: `${chI.id}-${chJ.id}`,
          title: `Bridging ${chI.name ?? 'Channel'} and ${chJ.name ?? 'Channel'}`,
          description: `Explore how ${crossover[0] || 'these topics'} intersect`,
          channels: [chI, chJ] as any,
          similarity: sim,
        });
      }
    }
  }

  return topics.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

// Helpers
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

export interface ConversationStarter {
  id: string;
  starter: string;
  post1: SignedPost;
  post2: SignedPost;
  similarity: number;
}

export interface DiscussionTopic {
  id: string;
  title: string;
  description: string;
  channels: NonNullable<ReturnType<typeof getChannel>>[];
  similarity: number;
}
