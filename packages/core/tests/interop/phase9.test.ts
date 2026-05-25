/* eslint-disable */
/**
 * Phase 9: Interoperability Tests
 */

import { describe, it, expect } from 'vitest';
import {
  // AT Protocol
  ATProtocolClient,
  RecordTypes,
  parseATUri,
  buildATUri,
  isValidHandle,
  isValidDID,
  extractMentions,
  extractHashtags,
  createEnrichedPost,
  ATRateLimiter,
  
  // Data Portability
  createDataExport,
  serializeExport,
  deserializeExport,
  validateExport,
  filterExportByDate,
  createExportSummary,
  
  // Follow Portability
  createSocialGraphExport,
  serializeGraph,
  deserializeGraph,
  exportToOPML,
  importFromOPML,
  exportToCSV,
  importFromCSV,
  findDuplicates,
  mergeSocialGraphs,
  validateGraphExport,
  calculateGraphStats,
} from '@isc/core';

describe('Phase 9: AT Protocol Bridge', () => {
  describe('ATProtocolClient', () => {
    it('should create client with default config', () => {
      const client = new ATProtocolClient();
      expect(client).toBeDefined();
      expect(client.isAuthenticated()).toBe(false);
    });

    it.skip('should create session', async () => {
      const client = new ATProtocolClient();
      const session = await client.createSession('test.example.com', 'password');
      
      expect(session.handle).toBe('test.example.com');
      expect(session.did).toBeDefined();
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should create post record', () => {
      const client = new ATProtocolClient();
      const record = client.createPostRecord('Hello, world!');
      
      expect(record.$type).toBe(RecordTypes.POST);
      expect(record.text).toBe('Hello, world!');
      expect(record.createdAt).toBeDefined();
    });

    it('should create post with reply', () => {
      const client = new ATProtocolClient();
      const record = client.createPostRecord('Reply!', {
        replyTo: {
          root: { uri: 'at://did:123/app.bsky.feed.post/abc', cid: 'cid1' },
          parent: { uri: 'at://did:123/app.bsky.feed.post/def', cid: 'cid2' },
        },
      });
      
      expect(record.reply).toBeDefined();
      expect(record.reply?.root.uri).toBe('at://did:123/app.bsky.feed.post/abc');
    });

    it('should create profile record', () => {
      const client = new ATProtocolClient();
      const record = client.createProfileRecord('Test User', 'Bio here');
      
      expect(record.$type).toBe(RecordTypes.PROFILE);
      expect(record.displayName).toBe('Test User');
      expect(record.description).toBe('Bio here');
    });

    it('should create follow record', () => {
      const client = new ATProtocolClient();
      const record = client.createFollowRecord('did:plc:123');
      
      expect(record.$type).toBe(RecordTypes.FOLLOW);
      expect(record.subject).toBe('did:plc:123');
    });

    it('should convert ISC post to AT format', () => {
      const client = new ATProtocolClient();
      const atPost = client.convertToATPost('Hello!', Date.now());
      
      expect(atPost.$type).toBe(RecordTypes.POST);
      expect(atPost.text).toBe('Hello!');
    });

    it('should convert AT post to ISC format', () => {
      const client = new ATProtocolClient();
      const atPost = client.createPostRecord('Hello!', { language: 'en' });
      const iscPost = client.convertFromATPost(atPost);
      
      expect(iscPost.content).toBe('Hello!');
      expect(iscPost.language).toBe('en');
    });
  });

  describe('parseATUri', () => {
    it('should parse valid AT URI', () => {
      const result = parseATUri('at://did:plc:123/app.bsky.feed.post/abc123');
      
      expect(result).toBeDefined();
      expect(result?.did).toBe('did:plc:123');
      expect(result?.collection).toBe('app.bsky.feed.post');
      expect(result?.rkey).toBe('abc123');
    });

    it('should return null for invalid URI', () => {
      const result = parseATUri('invalid-uri');
      expect(result).toBeNull();
    });
  });

  describe('buildATUri', () => {
    it('should build valid AT URI', () => {
      const uri = buildATUri('did:plc:123', 'app.bsky.feed.post', 'abc123');
      expect(uri).toBe('at://did:plc:123/app.bsky.feed.post/abc123');
    });
  });

  describe('isValidHandle', () => {
    it('should validate correct handles', () => {
      expect(isValidHandle('user.example.com')).toBe(true);
      expect(isValidHandle('test123.example.com')).toBe(true);
    });

    it('should reject invalid handles', () => {
      expect(isValidHandle('-user.example.com')).toBe(false);
      expect(isValidHandle('')).toBe(false);
    });
  });

  describe('isValidDID', () => {
    it('should validate correct DIDs', () => {
      expect(isValidDID('did:plc:abc123')).toBe(true);
      expect(isValidDID('did:web:example.com')).toBe(true);
    });

    it('should reject invalid DIDs', () => {
      expect(isValidDID('invalid-did')).toBe(false);
      expect(isValidDID('did:')).toBe(false);
    });
  });

  describe('extractMentions', () => {
    it('should extract mentions from text', () => {
      const mentions = extractMentions('Hello @user and @test!');
      
      expect(mentions.length).toBe(2);
      expect(mentions[0].handle).toBe('user');
      expect(mentions[1].handle).toBe('test');
    });

    it('should return empty array for no mentions', () => {
      const mentions = extractMentions('No mentions here');
      expect(mentions.length).toBe(0);
    });
  });

  describe('extractHashtags', () => {
    it('should extract hashtags from text', () => {
      const hashtags = extractHashtags('Check out #ISC and #OpenSource!');

      expect(hashtags.length).toBe(2);
      expect(hashtags[0].tag).toBe('ISC');
      expect(hashtags[1].tag).toBe('OpenSource');
    });
  });

  describe('createEnrichedPost', () => {
    it('should create post with entities', () => {
      const enriched = createEnrichedPost('Hello @user! Check #ISC');
      
      expect(enriched.text).toBe('Hello @user! Check #ISC');
      expect(enriched.entities.length).toBe(2);
      expect(enriched.entities[0].type).toBe('mention');
      expect(enriched.entities[1].type).toBe('tag');
    });
  });

  describe('ATRateLimiter', () => {
    it('should allow requests under limit', async () => {
      const limiter = new ATRateLimiter(5, 1000);
      
      for (let i = 0; i < 5; i++) {
        await limiter.throttle();
      }
      
      // 6th request should be delayed
      const start = Date.now();
      await limiter.throttle();
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThan(0);
    });
  });
});

describe('Phase 9: Data Portability', () => {
  describe('createDataExport', () => {
    it('should create export with all sections', () => {
      const exportData = createDataExport(
        {
          id: 'user123',
          displayName: 'Test User',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          posts: [{
            id: 'post1',
            content: 'Hello!',
            createdAt: new Date().toISOString(),
            likes: 0,
            reposts: 0,
            replies: 0,
          }],
          comments: [],
          media: [],
        },
        {
          following: [],
          followers: [],
          blocks: [],
          mutes: [],
        }
      );
      
      expect(exportData.version).toBeDefined();
      expect(exportData.user.id).toBe('user123');
      expect(exportData.content.posts.length).toBe(1);
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize and deserialize export', () => {
      const original = createDataExport(
        { id: 'user123', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { posts: [], comments: [], media: [] },
        { following: [], followers: [], blocks: [], mutes: [] }
      );
      
      const serialized = serializeExport(original);
      const deserialized = deserializeExport(serialized);
      
      expect(deserialized.user.id).toBe(original.user.id);
      expect(deserialized.version).toBe(original.version);
    });
  });

  describe('validateExport', () => {
    it('should validate correct export', () => {
      const exportData = createDataExport(
        { id: 'user123', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { posts: [], comments: [], media: [] },
        { following: [], followers: [], blocks: [], mutes: [] }
      );
      
      const result = validateExport(exportData);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing fields', () => {
      const invalid = { version: 'wrong' } as any;
      const result = validateExport(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('filterExportByDate', () => {
    it('should filter posts by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const tomorrow = new Date(now.getTime() + 86400000);
      
      const exportData = createDataExport(
        { id: 'user123', createdAt: now.toISOString(), updatedAt: now.toISOString() },
        {
          posts: [
            { id: 'post1', content: 'Old', createdAt: yesterday.toISOString(), likes: 0, reposts: 0, replies: 0 },
            { id: 'post2', content: 'New', createdAt: now.toISOString(), likes: 0, reposts: 0, replies: 0 },
          ],
          comments: [],
          media: [],
        },
        { following: [], followers: [], blocks: [], mutes: [] }
      );
      
      const filtered = filterExportByDate(exportData, now);
      expect(filtered.content.posts.length).toBe(1);
      expect(filtered.content.posts[0].id).toBe('post2');
    });
  });

  describe('createExportSummary', () => {
    it('should create summary with statistics', () => {
      const exportData = createDataExport(
        { id: 'user123', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        {
          posts: [
            { id: 'post1', content: 'Hello', createdAt: new Date().toISOString(), likes: 0, reposts: 0, replies: 0 },
          ],
          comments: [],
          media: [],
        },
        {
          following: [{ id: 'user1', connectedAt: new Date().toISOString() }],
          followers: [],
          blocks: [],
          mutes: [],
        }
      );
      
      const summary = createExportSummary(exportData);
      
      expect(summary.totalPosts).toBe(1);
      expect(summary.totalFollowing).toBe(1);
      expect(summary.sizeEstimate).toBeDefined();
    });
  });
});

describe('Phase 9: Follow Portability', () => {
  describe('createSocialGraphExport', () => {
    it('should create graph export', () => {
      const graph = createSocialGraphExport('user123', [
        { id: 'follow1', handle: '@user1', followedAt: new Date().toISOString() },
        { id: 'follow2', handle: '@user2', followedAt: new Date().toISOString() },
      ]);
      
      expect(graph.version).toBeDefined();
      expect(graph.following.length).toBe(2);
      expect(graph.metadata.totalFollowing).toBe(2);
    });
  });

  describe('serialize/deserialize graph', () => {
    it('should serialize and deserialize graph', () => {
      const original = createSocialGraphExport('user123', [
        { id: 'follow1', handle: '@user1', followedAt: new Date().toISOString() },
      ]);
      
      const serialized = serializeGraph(original);
      const deserialized = deserializeGraph(serialized);
      
      expect(deserialized.following.length).toBe(1);
      expect(deserialized.following[0].handle).toBe('@user1');
    });
  });

  describe('exportToOPML', () => {
    it('should export to OPML format', () => {
      const graph = createSocialGraphExport('user123', [
        { id: 'follow1', handle: '@user1', displayName: 'User One', followedAt: new Date().toISOString() },
      ], { handle: 'testuser' });
      
      const opml = exportToOPML(graph);
      
      expect(opml.version).toBe('2.0');
      expect(opml.outlines.length).toBe(1);
      expect(opml.outlines[0].text).toBe('User One');
    });
  });

  describe('importFromOPML', () => {
    it('should import from OPML format', () => {
      const opml = {
        version: '2.0',
        title: 'Following',
        dateCreated: new Date().toISOString(),
        outlines: [
          { text: 'User One', 'isc:id': 'user1', 'isc:handle': '@user1' },
        ],
      };
      
      const graph = importFromOPML(opml, 'opml-source');
      
      expect(graph.following.length).toBe(1);
      expect(graph.following[0].handle).toBe('@user1');
    });
  });

  describe('exportToCSV', () => {
    it('should export to CSV format', () => {
      const graph = createSocialGraphExport('user123', [
        { id: 'follow1', handle: '@user1', displayName: 'User One', followedAt: new Date().toISOString() },
      ]);
      
      const csv = exportToCSV(graph);
      
      expect(csv).toContain('id,handle,displayName');
      expect(csv).toContain('follow1');
    });
  });

  describe('importFromCSV', () => {
    it('should import from CSV format', () => {
      const csv = 'id,handle,displayName,followedAt\nfollow1,@user1,User One,2024-01-01T00:00:00.000Z';
      
      const graph = importFromCSV(csv, 'csv-source');
      
      expect(graph.following.length).toBe(1);
      expect(graph.following[0].handle).toBe('@user1');
    });
  });

  describe('findDuplicates', () => {
    it('should find duplicate connections', () => {
      const existing = [
        { id: 'user1', handle: '@user1', followedAt: new Date().toISOString() },
      ];
      const incoming = [
        { id: 'user1', handle: '@user1', followedAt: new Date().toISOString() },
        { id: 'user2', handle: '@user2', followedAt: new Date().toISOString() },
      ];
      
      const duplicates = findDuplicates(existing, incoming);
      
      expect(duplicates.length).toBe(1);
      expect(duplicates[0].matchType).toBe('id');
    });
  });

  describe('mergeSocialGraphs', () => {
    it('should merge graphs without duplicates', () => {
      const existing = createSocialGraphExport('user123', [
        { id: 'user1', handle: '@user1', followedAt: new Date().toISOString() },
      ]);
      const incoming = createSocialGraphExport('user456', [
        { id: 'user1', handle: '@user1', followedAt: new Date().toISOString() },
        { id: 'user2', handle: '@user2', followedAt: new Date().toISOString() },
      ]);
      
      const merged = mergeSocialGraphs(existing, incoming, { skipDuplicates: true });
      
      expect(merged.following.length).toBe(2);
    });
  });

  describe('validateGraphExport', () => {
    it('should validate correct graph', () => {
      const graph = createSocialGraphExport('user123', [
        { id: 'follow1', handle: '@user1', followedAt: new Date().toISOString() },
      ]);
      
      const result = validateGraphExport(graph);
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateGraphStats', () => {
    it('should calculate statistics', () => {
      const graph = createSocialGraphExport('user123', [
        { id: 'follow1', handle: '@user1', followedAt: new Date().toISOString(), source: 'platform-a' },
        { id: 'follow2', handle: '@user2', followedAt: new Date().toISOString(), source: 'platform-b' },
      ]);
      
      const stats = calculateGraphStats(graph);
      
      expect(stats.totalFollowing).toBe(2);
      expect(stats.bySource['platform-a']).toBe(1);
      expect(stats.bySource['platform-b']).toBe(1);
    });
  });
});

describe('Phase 9: Integration', () => {
  it('should complete full export/import flow', () => {
    // Create export
    const exportData = createDataExport(
      { id: 'user123', displayName: 'Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      {
        posts: [{ id: 'post1', content: 'Hello', createdAt: new Date().toISOString(), likes: 0, reposts: 0, replies: 0 }],
        comments: [],
        media: [],
      },
      { following: [], followers: [], blocks: [], mutes: [] }
    );
    
    // Serialize
    const serialized = serializeExport(exportData);
    
    // Deserialize
    const imported = deserializeExport(serialized);
    
    expect(imported.user.id).toBe('user123');
    expect(imported.content.posts.length).toBe(1);
  });

  it('should complete full graph export/import flow', () => {
    // Create graph
    const graph = createSocialGraphExport('user123', [
      { id: 'follow1', handle: '@user1', followedAt: new Date().toISOString() },
    ]);
    
    // Export to OPML
    const opml = exportToOPML(graph);
    
    // Import from OPML
    const imported = importFromOPML(opml, 'opml');
    
    expect(imported.following.length).toBe(1);
    expect(imported.following[0].handle).toBe('@user1');
  });
});
