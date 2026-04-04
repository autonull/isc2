/* eslint-disable */
import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../../src/math/cosine.js';
import {
  checkPostCoherence,
  checkPostCoherenceMultiChannel,
  getMostCoherentChannel,
  filterCoherentPosts,
  rankByCoherence,
  DEFAULT_COHERENCE_THRESHOLD,
  type ChannelDistribution,
} from '../../src/social/coherence.js';
import type { SignedPost } from '../../src/social/types.js';

describe('checkPostCoherence', () => {
  const mockChannelDist: ChannelDistribution[] = [
    { type: 'root', mu: [1, 0, 0], std: 0.1, weight: 1.0 },
  ];

  it('should return coherent for similar embeddings', () => {
    const post: SignedPost = {
      id: 'post1',
      author: 'author1',
      content: 'test',
      channelID: 'channel1',
      timestamp: Date.now(),
      signature: new Uint8Array(),
      embedding: [1, 0, 0],
    };

    const result = checkPostCoherence(post, mockChannelDist);
    expect(result.isCoherent).toBe(true);
    expect(result.score).toBeCloseTo(1, 5);
  });

  it('should return incoherent for different embeddings', () => {
    const post: SignedPost = {
      id: 'post1',
      author: 'author1',
      content: 'test',
      channelID: 'channel1',
      timestamp: Date.now(),
      signature: new Uint8Array(),
      embedding: [0, 1, 0],
    };

    const result = checkPostCoherence(post, mockChannelDist);
    expect(result.isCoherent).toBe(false);
    expect(result.score).toBeCloseTo(0, 5);
  });

  it('should handle empty distributions', () => {
    const post: SignedPost = {
      id: 'post1',
      author: 'author1',
      content: 'test',
      channelID: 'channel1',
      timestamp: Date.now(),
      signature: new Uint8Array(),
      embedding: [1, 0, 0],
    };

    const result = checkPostCoherence(post, []);
    expect(result.isCoherent).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should handle posts without embeddings', () => {
    const post: SignedPost = {
      id: 'post1',
      author: 'author1',
      content: 'test',
      channelID: 'channel1',
      timestamp: Date.now(),
      signature: new Uint8Array(),
    };

    const result = checkPostCoherence(post, mockChannelDist);
    expect(result.isCoherent).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should use custom threshold', () => {
    const post: SignedPost = {
      id: 'post1',
      author: 'author1',
      content: 'test',
      channelID: 'channel1',
      timestamp: Date.now(),
      signature: new Uint8Array(),
      embedding: [0.5, 0.5, 0],
    };

    const result = checkPostCoherence(post, mockChannelDist, 0.8);
    expect(result.isCoherent).toBe(false);
    expect(result.threshold).toBe(0.8);
  });
});

describe('checkPostCoherenceMultiChannel', () => {
  it('should rank channels by coherence', () => {
    const post: SignedPost = {
      id: 'post1',
      author: 'author1',
      content: 'test',
      channelID: 'channel1',
      timestamp: Date.now(),
      signature: new Uint8Array(),
      embedding: [1, 0, 0],
    };

    const channels = new Map<string, ChannelDistribution[]>();
    channels.set('tech', [{ type: 'root', mu: [1, 0, 0], std: 0.1, weight: 1.0 }]);
    channels.set('politics', [{ type: 'root', mu: [0, 1, 0], std: 0.1, weight: 1.0 }]);

    const results = checkPostCoherenceMultiChannel(post, channels);
    expect(results[0].channelID).toBe('tech');
    expect(results[0].result.score).toBeGreaterThan(results[1].result.score);
  });
});

describe('getMostCoherentChannel', () => {
  it('should return null for no coherent channels', () => {
    const post: SignedPost = {
      id: 'post1',
      author: 'author1',
      content: 'test',
      channelID: 'channel1',
      timestamp: Date.now(),
      signature: new Uint8Array(),
      embedding: [0, 1, 0],
    };

    const channels = new Map<string, ChannelDistribution[]>();
    channels.set('tech', [{ type: 'root', mu: [1, 0, 0], std: 0.1, weight: 1.0 }]);

    const result = getMostCoherentChannel(post, channels);
    expect(result).toBeNull();
  });
});

describe('filterCoherentPosts', () => {
  it('should filter to only coherent posts', () => {
    const posts: SignedPost[] = [
      { id: 'post1', author: 'a', content: 'c', channelID: 'ch', timestamp: 1, signature: new Uint8Array(), embedding: [1, 0, 0] },
      { id: 'post2', author: 'a', content: 'c', channelID: 'ch', timestamp: 2, signature: new Uint8Array(), embedding: [0, 1, 0] },
    ];

    const channelDist: ChannelDistribution[] = [
      { type: 'root', mu: [1, 0, 0], std: 0.1, weight: 1.0 },
    ];

    const filtered = filterCoherentPosts(posts, channelDist);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('post1');
  });
});

describe('rankByCoherence', () => {
  it('should rank posts by coherence', () => {
    const posts: SignedPost[] = [
      { id: 'post1', author: 'a', content: 'c', channelID: 'ch', timestamp: 1, signature: new Uint8Array(), embedding: [0, 1, 0] },
      { id: 'post2', author: 'a', content: 'c', channelID: 'ch', timestamp: 2, signature: new Uint8Array(), embedding: [1, 0, 0] },
      { id: 'post3', author: 'a', content: 'c', channelID: 'ch', timestamp: 3, signature: new Uint8Array(), embedding: [0.7, 0.7, 0] },
    ];

    const channelDist: ChannelDistribution[] = [
      { type: 'root', mu: [1, 0, 0], std: 0.1, weight: 1.0 },
    ];

    const ranked = rankByCoherence(posts, channelDist);
    expect(ranked[0].post.id).toBe('post2');
    expect(ranked[1].post.id).toBe('post3');
    expect(ranked[2].post.id).toBe('post1');
  });
});
