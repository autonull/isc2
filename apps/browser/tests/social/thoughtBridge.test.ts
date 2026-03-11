/**
 * Thought Bridge Tests
 */

import { describe, it, expect } from 'vitest';

describe('Thought Bridge', () => {
  describe('findCrossoverWords', () => {
    it('should find common words between two texts', async () => {
      const { findCrossoverWords } = await import('../../src/social/thoughtBridge');

      const text1 = 'The quick brown fox jumps over the lazy dog';
      const text2 = 'A quick brown dog runs in the park';

      const crossover = findCrossoverWords(text1, text2);

      expect(crossover).toContain('quick');
      expect(crossover).toContain('brown');
    });

    it('should exclude stop words', async () => {
      const { findCrossoverWords } = await import('../../src/social/thoughtBridge');

      const text1 = 'The cat and the dog are friends';
      const text2 = 'The bird and the fish are pets';

      const crossover = findCrossoverWords(text1, text2);

      // Should not include 'the', 'and', 'are'
      expect(crossover).not.toContain('the');
      expect(crossover).not.toContain('and');
      expect(crossover).not.toContain('are');
    });

    it('should limit to 10 words', async () => {
      const { findCrossoverWords } = await import('../../src/social/thoughtBridge');

      const words = Array(20).fill('common').join(' ');
      const text1 = words;
      const text2 = words;

      const crossover = findCrossoverWords(text1, text2);

      expect(crossover.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateConversationStarter', () => {
    it('should generate starter for similar posts', async () => {
      const { generateConversationStarter } = await import('../../src/social/thoughtBridge');

      const post1 = {
        id: 'post-1',
        author: 'user1',
        content: 'I love programming in TypeScript',
        channelID: 'tech',
        timestamp: Date.now(),
        embedding: [0.8, 0.9, 0.7, 0.8],
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const post2 = {
        id: 'post-2',
        author: 'user2',
        content: 'TypeScript is great for programming',
        channelID: 'tech',
        timestamp: Date.now(),
        embedding: [0.85, 0.88, 0.72, 0.82],
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const starter = await generateConversationStarter(post1, post2);

      expect(starter).toBeDefined();
      expect(starter.length).toBeGreaterThan(0);
    });

    it('should generate different starters based on similarity', async () => {
      const { generateConversationStarter } = await import('../../src/social/thoughtBridge');

      const similar1 = {
        id: 'post-1',
        author: 'user1',
        content: 'I love programming',
        channelID: 'tech',
        timestamp: Date.now(),
        embedding: [0.9, 0.9, 0.9, 0.9],
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const similar2 = {
        id: 'post-2',
        author: 'user2',
        content: 'Programming is love',
        channelID: 'tech',
        timestamp: Date.now(),
        embedding: [0.88, 0.92, 0.88, 0.9],
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const different = {
        id: 'post-3',
        author: 'user3',
        content: 'I hate cooking',
        channelID: 'life',
        timestamp: Date.now(),
        embedding: [0.1, 0.2, 0.1, 0.2],
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const starterSimilar = await generateConversationStarter(similar1, similar2);
      const starterDifferent = await generateConversationStarter(similar1, different);

      expect(starterSimilar).not.toBe(starterDifferent);
    });
  });

  describe('getConversationStarters', () => {
    it('should return conversation starters for a channel', async () => {
      const { getConversationStarters } = await import('../../src/social/thoughtBridge');

      // Mock getChannel and queryPostsByEmbedding are handled by test setup
      const starters = await getConversationStarters('test-channel');

      expect(Array.isArray(starters)).toBe(true);
    });
  });

  describe('findBridgingPosts', () => {
    it('should find posts that bridge two channels', async () => {
      const { findBridgingPosts } = await import('../../src/social/thoughtBridge');

      const posts = await findBridgingPosts('channel-1', 'channel-2');

      expect(Array.isArray(posts)).toBe(true);
    });
  });

  describe('suggestDiscussionTopics', () => {
    it('should suggest discussion topics for multiple channels', async () => {
      const { suggestDiscussionTopics } = await import('../../src/social/thoughtBridge');

      const topics = await suggestDiscussionTopics(['channel-1', 'channel-2', 'channel-3']);

      expect(Array.isArray(topics)).toBe(true);
    });

    it('should return empty array for single channel', async () => {
      const { suggestDiscussionTopics } = await import('../../src/social/thoughtBridge');

      const topics = await suggestDiscussionTopics(['channel-1']);

      expect(topics).toEqual([]);
    });
  });

  describe('tokenize helper', () => {
    it('should tokenize text into words', async () => {
      // Access the internal tokenize function through the module
      const module = await import('../../src/social/thoughtBridge');
      
      // Test via findCrossoverWords which uses tokenize internally
      const { findCrossoverWords } = module;
      
      const text1 = 'Hello world this is a test';
      const text2 = 'Hello there world test';
      
      const crossover = findCrossoverWords(text1, text2);
      
      expect(crossover).toContain('hello');
      expect(crossover).toContain('world');
      expect(crossover).toContain('test');
    });

    it('should filter out short words', async () => {
      const { findCrossoverWords } = await import('../../src/social/thoughtBridge');

      const text1 = 'I am a big elephant';
      const text2 = 'You are big too';

      const crossover = findCrossoverWords(text1, text2);

      // Should not include 'i', 'a', 'am' (too short)
      expect(crossover).not.toContain('i');
      expect(crossover).not.toContain('a');
      expect(crossover).toContain('big');
    });
  });
});
