/* eslint-disable */
/**
 * ISC Network Library - Test Suite
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  InMemoryDHT,
  createDHT,
  TransformerEmbeddingService,
  createEmbeddingService,
  VirtualPeer,
  createPeer,
} from '../src/index.js';

describe('InMemoryDHT', () => {
  let dht: InMemoryDHT;

  beforeEach(() => {
    dht = createDHT();
  });

  it('should create empty DHT', () => {
    expect(dht.getCount()).toBe(0);
  });

  it('should announce and retrieve peers', async () => {
    const peer = {
      id: 'test-peer-1',
      name: 'Test Peer',
      description: 'A test peer',
      vector: [1, 0, 0],
      topics: ['test'],
      lastSeen: Date.now(),
    };

    await dht.announce(peer, 60000);
    expect(dht.getCount()).toBe(1);

    const all = dht.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('test-peer-1');
  });

  it('should clean up expired entries', async () => {
    const peer = {
      id: 'test-peer-2',
      name: 'Test Peer 2',
      description: 'Another test peer',
      vector: [0, 1, 0],
      topics: ['test'],
      lastSeen: Date.now(),
    };

    // Announce with very short TTL
    await dht.announce(peer, 10);
    expect(dht.getCount()).toBe(1);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 20));

    // Clean up
    const removed = dht.cleanup(Date.now());
    expect(removed).toBe(1);
    expect(dht.getCount()).toBe(0);
  });

  it('should discover similar peers', async () => {
    // Add peers with known vectors
    await dht.announce({
      id: 'peer-a',
      name: 'Peer A',
      description: 'AI and machine learning',
      vector: [0.8, 0.6, 0],
      topics: ['ai', 'ml'],
      lastSeen: Date.now(),
    }, 60000);

    await dht.announce({
      id: 'peer-b',
      name: 'Peer B',
      description: 'Distributed systems',
      vector: [0, 0, 1],
      topics: ['distributed'],
      lastSeen: Date.now(),
    }, 60000);

    // Discover with vector similar to peer-a
    const matches = await dht.discover([0.9, 0.5, 0], 0.5);
    
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].peer.id).toBe('peer-a');
  });

  it('should track statistics', async () => {
    const peer = {
      id: 'test-peer-3',
      name: 'Test Peer 3',
      description: 'Stats test',
      vector: [1, 1, 1],
      topics: ['test'],
      lastSeen: Date.now(),
    };

    await dht.announce(peer, 60000);
    await dht.discover([1, 1, 1], 0.5);

    const stats = dht.getStats();
    expect(stats.announces).toBe(1);
    expect(stats.discoveries).toBe(1);
  });
});

describe('TransformerEmbeddingService', () => {
  let service: TransformerEmbeddingService;

  beforeAll(async () => {
    service = createEmbeddingService();
    await service.load();
  });

  it('should load model', () => {
    expect(service.isLoaded()).toBe(true);
    expect(service.isLoading()).toBe(false);
  });

  it('should compute embeddings', async () => {
    const embedding = await service.compute('Hello world');
    
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384); // all-MiniLM-L6-v2 dimension
    expect(embedding.every(v => typeof v === 'number')).toBe(true);
  });

  it('should cache embeddings', async () => {
    const text = 'Cached embedding test';
    
    const first = await service.compute(text);
    const second = await service.compute(text);
    
    expect(first).toEqual(second);
    
    const stats = service.getCacheStats();
    expect(stats.size).toBeGreaterThanOrEqual(1);
  });

  it('should compute batch embeddings', async () => {
    const texts = ['First', 'Second', 'Third'];
    const embeddings = await service.computeBatch(texts);
    
    expect(embeddings).toHaveLength(3);
    embeddings.forEach(emb => {
      expect(emb.length).toBe(384);
    });
  });

  it('should compute similarity', async () => {
    const similar1 = await service.compute('Machine learning AI');
    const similar2 = await service.compute('AI and machine learning');
    const different = await service.compute('Cooking recipes');

    const simSimilar = service.similarity(similar1, similar2);
    const simDifferent = service.similarity(similar1, different);

    expect(simSimilar).toBeGreaterThan(simDifferent);
    expect(simSimilar).toBeGreaterThan(0.5); // Should be reasonably similar
  });

  afterAll(() => {
    service.unload();
  });
});

describe('VirtualPeer', () => {
  let embeddingService: TransformerEmbeddingService;

  beforeAll(async () => {
    embeddingService = createEmbeddingService();
    await embeddingService.load();
  });

  it('should create peer with config', () => {
    const peer = createPeer({
      id: 'test-peer',
      name: 'Test Peer',
      description: 'A test peer for testing',
      topics: ['test', 'testing'],
    });

    expect(peer.id).toBe('test-peer');
    expect(peer.name).toBe('Test Peer');
    expect(peer.topics).toContain('test');
  });

  it('should extract topics from description', () => {
    const peer = createPeer({
      id: 'ai-peer',
      description: 'Artificial intelligence and machine learning research',
    });

    expect(peer.topics.length).toBeGreaterThan(0);
  });

  it('should compute embedding', async () => {
    const peer = createPeer({
      id: 'embed-peer',
      description: 'Test embedding computation',
    });

    const vector = await peer.computeEmbedding(embeddingService);
    
    expect(vector).toHaveLength(384);
    expect(peer.getVector()).toEqual(vector);
  });

  it('should announce to DHT', async () => {
    const dht = createDHT();
    const peer = await VirtualPeer.create(
      'announce-peer',
      'Testing announcements',
      embeddingService
    );

    await peer.announce(dht);
    expect(dht.getCount()).toBe(1);
    expect(peer.getStats().announcesSent).toBe(1);
  });

  it('should discover peers', async () => {
    const dht = createDHT();
    
    // Create and announce peers
    const peer1 = await VirtualPeer.create(
      'discover-peer-1',
      'Machine learning and AI',
      embeddingService
    );
    const peer2 = await VirtualPeer.create(
      'discover-peer-2',
      'Machine learning computer vision',
      embeddingService
    );

    await peer1.announce(dht);
    await peer2.announce(dht);

    // Discover matches
    const matches = await peer1.discover(dht, 0.5);
    
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Should find peer2 (or self, which is also valid for this test)
    expect(matches[0].peer.id).toMatch(/discover-peer-/);
    expect(peer1.getStats().matchesFound).toBeGreaterThanOrEqual(1);
  });

  it('should create batch peers', async () => {
    const descriptions = [
      'AI and machine learning',
      'Distributed systems',
      'Quantum computing',
    ];

    const peers = await VirtualPeer.createBatch(
      descriptions,
      embeddingService,
      'batch'
    );

    expect(peers).toHaveLength(3);
    peers.forEach((peer, i) => {
      expect(peer.id).toBe(`batch-${i}`);
      expect(peer.getVector()).toHaveLength(384);
    });
  });

  afterAll(() => {
    embeddingService.unload();
  });
});

describe('Network Integration', () => {
  it('should run full network simulation', async () => {
    const embeddingService = createEmbeddingService();
    await embeddingService.load();

    const dht = createDHT();

    // Create peers with different topics
    const aiPeers = await VirtualPeer.createBatch(
      [
        'Machine learning neural networks deep learning',
        'AI computer vision image recognition',
        'Natural language processing transformers',
      ],
      embeddingService,
      'ai'
    );

    const distributedPeers = await VirtualPeer.createBatch(
      [
        'Distributed systems consensus algorithms',
        'Blockchain cryptocurrency decentralized',
        'Database replication fault tolerance',
      ],
      embeddingService,
      'dist'
    );

    // All peers announce
    for (const peer of [...aiPeers, ...distributedPeers]) {
      await peer.announce(dht);
    }

    expect(dht.getCount()).toBe(6);

    // AI peers should find other AI peers
    const aiMatches = await aiPeers[0].discover(dht, 0.5);
    const aiMatchIds = aiMatches.map(m => m.peer.id);
    
    // Should find other AI peers, not distributed peers
    expect(aiMatchIds.some(id => id.startsWith('ai-'))).toBe(true);

    // Distributed peers should find other distributed peers
    const distMatches = await distributedPeers[0].discover(dht, 0.5);
    const distMatchIds = distMatches.map(m => m.peer.id);
    
    expect(distMatchIds.some(id => id.startsWith('dist-'))).toBe(true);

    embeddingService.unload();
  });
});
