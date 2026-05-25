/* eslint-disable */
/**
 * Channel-Based Message Routing Tests
 *
 * Core invariants: messages route by channel embedding, not per-post embedding.
 * Tests against InMemoryDHT to verify the critical correctness guarantee.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDHT } from '../src/dht.js';
import { lshHash } from '@isc/core';

// Minimal channel-like objects for testing
interface TestChannel {
  id: string;
  name: string;
  description: string;
  embedding: number[];
}

interface TestPost {
  id: string;
  channelId: string;
  channelName: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: number;
}

const POST_TTL = 24 * 60 * 60 * 1000;
const CANDIDATE_CAP = 20;

/**
 * Store a post in the DHT under a channel's LSH bucket keys.
 * Mirrors the logic in browser.ts createPost().
 */
async function storePost(dht: InMemoryDHT, channel: TestChannel, post: TestPost): Promise<void> {
  const hashes = lshHash(channel.embedding, 'allminilm', 20, 32);
  const payload = new TextEncoder().encode(JSON.stringify(post));
  for (const hash of hashes.slice(0, 5)) {
    await dht.put(`/isc/post/allminilm/${hash}`, payload, POST_TTL);
  }
}

/**
 * Fetch posts for a channel from the DHT.
 * Mirrors the logic in browser.ts fetchMessagesForChannel().
 */
async function fetchPosts(dht: InMemoryDHT, channel: TestChannel): Promise<TestPost[]> {
  const hashes = lshHash(channel.embedding, 'allminilm', 20, 32);
  const seen = new Map<string, TestPost>();

  for (const hash of hashes) {
    const results = await dht.get(`/isc/post/allminilm/${hash}`, CANDIDATE_CAP);
    for (const bytes of results) {
      try {
        const post = JSON.parse(new TextDecoder().decode(bytes)) as TestPost;
        if (!seen.has(post.id)) seen.set(post.id, post);
      } catch { /* skip malformed */ }
    }
  }

  return [...seen.values()];
}

/**
 * Create a normalized embedding vector of a given dimension.
 * Uses a simple deterministic pattern based on angle for reproducibility.
 */
function makeEmbedding(angle: number, dims = 384): number[] {
  const vec: number[] = [];
  for (let i = 0; i < dims; i++) {
    vec.push(Math.cos(angle + i * 0.01));
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map(v => v / norm);
}

describe('channel-based message routing', () => {
  let dht: InMemoryDHT;

  // Channel A: angle 0 (base)
  const channelA: TestChannel = {
    id: 'ch_a',
    name: 'Distributed Systems',
    description: 'Distributed systems and consensus algorithms',
    embedding: makeEmbedding(0),
  };

  // Channel B: angle Math.PI (semantically opposite — no shared LSH buckets)
  const channelB: TestChannel = {
    id: 'ch_b',
    name: 'Art History',
    description: 'Renaissance painting and classical art',
    embedding: makeEmbedding(Math.PI),
  };

  // Channel C: very close to A (angle 0.001 — nearly identical, should share buckets)
  const channelC: TestChannel = {
    id: 'ch_c',
    name: 'Consensus Protocols',
    description: 'Distributed consensus and partition tolerance',
    embedding: makeEmbedding(0.001),
  };

  const post: TestPost = {
    id: 'post_1',
    channelId: 'ch_a',
    channelName: 'Distributed Systems',
    content: 'CAP theorem in practice',
    author: 'Alice',
    authorId: 'peer_alice',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    dht = new InMemoryDHT();
  });

  it('1. Post stored in channel A is retrievable from channel A', async () => {
    await storePost(dht, channelA, post);
    const posts = await fetchPosts(dht, channelA);
    expect(posts.some(p => p.id === post.id)).toBe(true);
  });

  it('2. Post stored in channel A is NOT retrievable from semantically distant channel B', async () => {
    await storePost(dht, channelA, post);
    const posts = await fetchPosts(dht, channelB);
    expect(posts.some(p => p.id === post.id)).toBe(false);
  });

  it('3. fetchMessagesForChannel(A) returns the post', async () => {
    await storePost(dht, channelA, post);
    const posts = await fetchPosts(dht, channelA);
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe(post.id);
    expect(posts[0].content).toBe(post.content);
  });

  it('4. fetchMessagesForChannel(C) — semantically similar to A — also returns the post', async () => {
    await storePost(dht, channelA, post);
    const posts = await fetchPosts(dht, channelC);
    // C is nearly identical to A so they share LSH buckets
    expect(posts.some(p => p.id === post.id)).toBe(true);
  });

  it('5. fetchMessagesForChannel(B) — semantically distant — does NOT return the post', async () => {
    await storePost(dht, channelA, post);
    const posts = await fetchPosts(dht, channelB);
    expect(posts.some(p => p.id === post.id)).toBe(false);
  });

  it('6. Multiple posts in the same channel are all retrievable', async () => {
    const post2: TestPost = { ...post, id: 'post_2', content: 'Paxos vs Raft' };
    const post3: TestPost = { ...post, id: 'post_3', content: 'Vector clocks explained' };

    await storePost(dht, channelA, post);
    await storePost(dht, channelA, post2);
    await storePost(dht, channelA, post3);

    const posts = await fetchPosts(dht, channelA);
    const ids = posts.map(p => p.id);
    expect(ids).toContain('post_1');
    expect(ids).toContain('post_2');
    expect(ids).toContain('post_3');
  });

  it('7. DHT put/get respects TTL — expired entries are not returned', async () => {
    const dhtShort = new InMemoryDHT();
    const shortTtl = 1; // 1ms TTL
    const hashes = lshHash(channelA.embedding, 'allminilm', 20, 32);
    const payload = new TextEncoder().encode(JSON.stringify(post));

    for (const hash of hashes.slice(0, 5)) {
      await dhtShort.put(`/isc/post/allminilm/${hash}`, payload, shortTtl);
    }

    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 10));

    const posts = await fetchPosts(dhtShort, channelA);
    expect(posts.some(p => p.id === post.id)).toBe(false);
  });
});
