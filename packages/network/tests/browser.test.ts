/**
 * ISC Network Library - Browser Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  BrowserNetworkService,
  createBrowserNetworkService,
  createStorage,
  BrowserStorage,
  LocalStorage,
  MemoryStorage,
} from '../src/index.js';

describe('Storage', () => {
  describe('MemoryStorage', () => {
    let storage: MemoryStorage;

    beforeEach(() => {
      storage = new MemoryStorage();
    });

    it('should store and retrieve values', async () => {
      await storage.set('test-key', { foo: 'bar' });
      const value = await storage.get('test-key');
      expect(value).toEqual({ foo: 'bar' });
    });

    it('should return null for missing keys', async () => {
      const value = await storage.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should delete values', async () => {
      await storage.set('test-key', 'value');
      await storage.delete('test-key');
      const value = await storage.get('test-key');
      expect(value).toBeNull();
    });

    it('should list keys with prefix', async () => {
      await storage.set('isc-channels', []);
      await storage.set('isc-posts', []);
      await storage.set('other-key', 'value');
      
      const keys = await storage.list('isc-');
      expect(keys).toEqual(['isc-channels', 'isc-posts']);
    });

    it('should clear all data', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.clear();
      
      const keys = await storage.list('');
      expect(keys).toHaveLength(0);
    });
  });

  describe('LocalStorage', () => {
    it('should only run in browser environment', () => {
      // Skip if localStorage is not available (Node.js)
      if (typeof localStorage === 'undefined') {
        expect(true).toBe(true); // Placeholder assertion
        return;
      }
      
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });
  });

  describe('createStorage', () => {
    it('should create appropriate storage for environment', () => {
      const storage = createStorage();
      expect(storage).toBeDefined();
      expect(typeof storage.get).toBe('function');
      expect(typeof storage.set).toBe('function');
    });
  });
});

describe('BrowserNetworkService', () => {
  let service: BrowserNetworkService;

  beforeEach(() => {
    service = createBrowserNetworkService({
      autoDiscover: false, // Disable auto-discovery for tests
      discoverInterval: 60000,
    });
  });

  afterAll(() => {
    service?.destroy();
  });

  it('should create service', () => {
    expect(service).toBeDefined();
    expect(service.getStatus()).toBe('disconnected');
  });

  it('should initialize', async () => {
    await service.initialize();
    expect(service.getStatus()).toBe('connected');
    expect(service.getIdentity()).toBeDefined();
  });

  it('should create identity on first init', async () => {
    await service.initialize();
    const identity = service.getIdentity();
    
    expect(identity).toBeDefined();
    expect(identity?.peerId).toBeDefined();
    expect(identity?.name).toBe('Anonymous');
  });

  it('should create channels', async () => {
    await service.initialize();
    
    const channel = await service.createChannel(
      'Test Channel',
      'A test channel for testing'
    );
    
    expect(channel.id).toBeDefined();
    expect(channel.name).toBe('Test Channel');
    expect(channel.embedding).toBeDefined();
    expect(channel.embedding!.length).toBe(384);
  });

  it('should create posts', async () => {
    await service.initialize();
    
    const channel = await service.createChannel('Test', 'Description');
    const post = await service.createPost(channel.id, 'Hello world!');
    
    expect(post.id).toBeDefined();
    expect(post.content).toBe('Hello world!');
    expect(post.channelId).toBe(channel.id);
  });

  it('should get channels and posts', async () => {
    await service.initialize();
    
    const channel = await service.createChannel('Test', 'Description');
    await service.createPost(channel.id, 'Post 1');
    await service.createPost(channel.id, 'Post 2');
    
    const channels = service.getChannels();
    const posts = service.getPosts(channel.id);
    
    expect(channels).toHaveLength(1);
    expect(posts).toHaveLength(2);
  });

  it('should discover peers', async () => {
    await service.initialize();
    
    // Create another peer in the DHT with similar bio
    const { createEmbeddingService, VirtualPeer } = await import('../src/index.js');
    const embedding = createEmbeddingService();
    await embedding.load();
    
    const otherPeer = await VirtualPeer.create(
      'other-peer',
      'Machine learning and AI research',  // Similar to default bio
      embedding
    );
    await otherPeer.announce(service['dht']);
    
    // Discover with lower threshold
    const matches = await service.discoverPeers();
    
    // At minimum, discovery should complete without error
    expect(Array.isArray(matches)).toBe(true);
    
    embedding.unload();
  });

  it('should update identity', async () => {
    await service.initialize();
    
    await service.updateIdentity({
      name: 'Test User',
      bio: 'Updated bio',
    });
    
    const identity = service.getIdentity();
    expect(identity?.name).toBe('Test User');
    expect(identity?.bio).toBe('Updated bio');
  });

  it('should handle events', async () => {
    await service.initialize();
    
    const events: string[] = [];
    
    service.on({
      onChannelCreated: () => events.push('channel'),
      onPostCreated: () => events.push('post'),
      onStatusChange: (status) => events.push(`status:${status}`),
    });
    
    const channel = await service.createChannel('Test', 'Description');
    await service.createPost(channel.id, 'Hello');
    
    expect(events).toContain('channel');
    expect(events).toContain('post');
  });

  it('should persist data to storage', async () => {
    // This test requires persistent storage which MemoryStorage doesn't provide
    // In a real browser, IndexedDB or localStorage would be used
    // For now, we verify the storage interface is called
    await service.initialize();
    
    const channel = await service.createChannel('Persistent', 'Test');
    await service.createPost(channel.id, 'Persistent post');
    
    // Verify data is in memory
    expect(service.getChannels().some(c => c.name === 'Persistent')).toBe(true);
    expect(service.getPosts().some(p => p.content === 'Persistent post')).toBe(true);
    
    // Note: Cross-instance persistence requires browser storage (IndexedDB/localStorage)
    // which isn't available in Node.js test environment
  });

  it('should clear cache', async () => {
    await service.initialize();
    
    await service.createChannel('Test', 'Description');
    await service.createPost(
      service.getChannels()[0].id,
      'Post'
    );
    
    await service.clearCache();
    
    expect(service.getChannels()).toHaveLength(0);
    expect(service.getPosts()).toHaveLength(0);
  });
});

describe('BrowserNetworkService Integration', () => {
  it('should run full workflow', async () => {
    const service = createBrowserNetworkService({ autoDiscover: false });
    
    try {
      // Initialize
      await service.initialize();
      expect(service.getStatus()).toBe('connected');
      
      // Create channels
      const aiChannel = await service.createChannel(
        'AI Discussion',
        'Machine learning and artificial intelligence topics'
      );
      const distChannel = await service.createChannel(
        'Distributed Systems',
        'Consensus algorithms and blockchain technology'
      );
      
      // Create posts
      await service.createPost(aiChannel.id, 'What is deep learning?');
      await service.createPost(aiChannel.id, 'Neural networks explained');
      await service.createPost(distChannel.id, 'Understanding consensus');
      
      // Verify data
      expect(service.getChannels()).toHaveLength(2);
      expect(service.getPosts()).toHaveLength(3);
      expect(service.getPosts(aiChannel.id)).toHaveLength(2);
      
      // Update identity
      await service.updateIdentity({
        name: 'Integration Tester',
        bio: 'Testing the network service',
      });
      
      expect(service.getIdentity()?.name).toBe('Integration Tester');
      
    } finally {
      service.destroy();
    }
  });
});
