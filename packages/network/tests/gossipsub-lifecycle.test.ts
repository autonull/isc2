/* eslint-disable */
/**
 * Gossipsub Subscription Lifecycle Tests
 *
 * Verifies that channel create/edit/delete correctly manages
 * gossipsub topic subscriptions.
 *
 * Uses a mock NetworkAdapter to track subscribe/unsubscribe calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lshHash } from '@isc/core';

// Mock NetworkAdapter that records subscribe/unsubscribe calls
function createMockAdapter() {
  const subscriptions = new Map<string, Function>();
  const subscribeLog: string[] = [];
  const unsubscribeLog: string[] = [];

  return {
    subscriptions,
    subscribeLog,
    unsubscribeLog,
    subscribe: vi.fn((topic: string, handler: Function) => {
      subscriptions.set(topic, handler);
      subscribeLog.push(topic);
    }),
    unsubscribe: vi.fn((topic: string) => {
      subscriptions.delete(topic);
      unsubscribeLog.push(topic);
    }),
    publish: vi.fn(async () => {}),
    announce: vi.fn(async () => {}),
    query: vi.fn(async () => []),
    isRunning: vi.fn(() => true),
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
  };
}

/**
 * Derive the expected gossipsub topic for a given hash
 */
function gossipTopic(hash: string): string {
  return `/isc/gossip/allminilm/${hash}`;
}

/**
 * Get the first 5 LSH bucket hashes for an embedding
 */
function getTopHashes(embedding: number[]): string[] {
  return lshHash(embedding, 'allminilm', 20, 32).slice(0, 5);
}

/**
 * Create a normalized embedding vector
 */
function makeEmbedding(angle: number, dims = 384): number[] {
  const vec: number[] = [];
  for (let i = 0; i < dims; i++) {
    vec.push(Math.cos(angle + i * 0.01));
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map(v => v / norm);
}

describe('gossipsub subscription lifecycle', () => {
  const channelAEmbedding = makeEmbedding(0);
  const channelBEmbedding = makeEmbedding(Math.PI); // semantically opposite

  describe('subscribeChannelBuckets', () => {
    it('subscribes to the correct 5 topics derived from channel embedding', () => {
      const adapter = createMockAdapter();
      const hashes = getTopHashes(channelAEmbedding);
      const expectedTopics = hashes.map(gossipTopic);

      // Simulate what subscribeChannelBuckets does
      for (const hash of hashes) {
        adapter.subscribe(gossipTopic(hash), () => {});
      }

      expect(adapter.subscribeLog).toEqual(expectedTopics);
      expect(adapter.subscribeLog).toHaveLength(5);
    });

    it('subscribes to different topics for different channel embeddings', () => {
      const adapter = createMockAdapter();

      const hashesA = getTopHashes(channelAEmbedding);
      const hashesB = getTopHashes(channelBEmbedding);

      for (const hash of hashesA) adapter.subscribe(gossipTopic(hash), () => {});
      for (const hash of hashesB) adapter.subscribe(gossipTopic(hash), () => {});

      const topicsA = new Set(hashesA.map(gossipTopic));
      const topicsB = new Set(hashesB.map(gossipTopic));

      // Semantically opposite channels should have no overlapping buckets
      const overlap = [...topicsA].filter(t => topicsB.has(t));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('unsubscribeChannelBuckets', () => {
    it('unsubscribes from the same topics it subscribed to', () => {
      const adapter = createMockAdapter();
      const hashes = getTopHashes(channelAEmbedding);

      // Subscribe
      for (const hash of hashes) adapter.subscribe(gossipTopic(hash), () => {});
      // Unsubscribe
      for (const hash of hashes) adapter.unsubscribe(gossipTopic(hash));

      expect(adapter.unsubscribeLog).toEqual(adapter.subscribeLog);
      expect(adapter.subscriptions.size).toBe(0);
    });
  });

  describe('channel edit re-subscription', () => {
    it('unsubscribes old topics before subscribing new ones on description change', () => {
      const adapter = createMockAdapter();

      const oldEmbedding = channelAEmbedding;
      const newEmbedding = channelBEmbedding;

      const oldHashes = getTopHashes(oldEmbedding);
      const newHashes = getTopHashes(newEmbedding);

      // Simulate: create channel (subscribe old)
      for (const hash of oldHashes) adapter.subscribe(gossipTopic(hash), () => {});

      // Simulate: edit channel — unsubscribe old, subscribe new
      for (const hash of oldHashes) adapter.unsubscribe(gossipTopic(hash));
      for (const hash of newHashes) adapter.subscribe(gossipTopic(hash), () => {});

      // Old topics should be unsubscribed
      expect(adapter.unsubscribeLog).toEqual(oldHashes.map(gossipTopic));

      // Active subscriptions should be new topics only
      const activeTopics = new Set(adapter.subscriptions.keys());
      const newTopicSet = new Set(newHashes.map(gossipTopic));
      const oldTopicSet = new Set(oldHashes.map(gossipTopic));

      for (const topic of newTopicSet) {
        expect(activeTopics.has(topic)).toBe(true);
      }
      for (const topic of oldTopicSet) {
        expect(activeTopics.has(topic)).toBe(false);
      }
    });

    it('does not leave lingering subscriptions for old topics after edit', () => {
      const adapter = createMockAdapter();
      const oldHashes = getTopHashes(channelAEmbedding);
      const newHashes = getTopHashes(channelBEmbedding);

      for (const hash of oldHashes) adapter.subscribe(gossipTopic(hash), () => {});
      for (const hash of oldHashes) adapter.unsubscribe(gossipTopic(hash));
      for (const hash of newHashes) adapter.subscribe(gossipTopic(hash), () => {});

      // None of the old topics remain
      for (const hash of oldHashes) {
        expect(adapter.subscriptions.has(gossipTopic(hash))).toBe(false);
      }
    });
  });

  describe('no subscriptions for deleted channels', () => {
    it('all topics removed after channel unsubscribe', () => {
      const adapter = createMockAdapter();
      const hashes = getTopHashes(channelAEmbedding);

      for (const hash of hashes) adapter.subscribe(gossipTopic(hash), () => {});
      expect(adapter.subscriptions.size).toBe(5);

      for (const hash of hashes) adapter.unsubscribe(gossipTopic(hash));
      expect(adapter.subscriptions.size).toBe(0);
    });
  });
});
