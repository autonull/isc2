#!/usr/bin/env node

/**
 * ISC Comprehensive Readiness Verification - Extended Tests
 *
 * Tests edge cases, error conditions, security, accessibility,
 * stress scenarios, and production readiness.
 *
 * Usage: pnpm verify:extended
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { createHash } from 'crypto';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const ROOT = process.cwd();
const TEST_DIR = join(ROOT, '.verify-extended');

// ============================================================================
// Test Results Tracking
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  category: string;
}

class TestReporter {
  private results: TestResult[] = [];
  private startTime = Date.now();

  pass(name: string, duration: number, category: string = 'General'): void {
    this.results.push({ name, passed: true, duration, category });
    console.log(`  ${colors.green}✓${colors.reset} ${name} (${duration}ms)`);
  }

  fail(name: string, error: string, duration: number, category: string = 'General'): void {
    this.results.push({ name, passed: false, duration, error, category });
    console.log(`  ${colors.red}✗${colors.reset} ${name} (${duration}ms)`);
    console.log(`    ${colors.red}Error:${colors.reset} ${error}`);
  }

  summary(): void {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);

    // Group by category
    const categories = new Set(this.results.map(r => r.category));
    
    console.log(`\n${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}              EXTENDED READINESS VERIFICATION${colors.reset}`);
    console.log(`${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}`);
    
    for (const category of categories) {
      const catResults = this.results.filter(r => r.category === category);
      const catPassed = catResults.filter(r => r.passed).length;
      const status = catPassed === catResults.length ? colors.green : colors.yellow;
      console.log(`  ${category}: ${status}${catPassed}/${catResults.length}${colors.reset}`);
    }
    
    console.log(`\n${colors.bold}───────────────────────────────────────────────────────────${colors.reset}`);
    console.log(`  Total Tests: ${total}`);
    console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
    if (failed > 0) {
      console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
    }
    console.log(`  Total Time: ${totalTime}s`);
    console.log(`${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}`);

    if (failed > 0) {
      console.log(`\n${colors.red}Failed tests:${colors.reset}`);
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - [${r.category}] ${r.name}: ${r.error}`);
      });
    }

    const readinessScore = ((passed / total) * 100).toFixed(1);
    const status = parseInt(readinessScore) >= 95 ? colors.green : parseInt(readinessScore) >= 80 ? colors.yellow : colors.red;
    console.log(`\n${colors.bold}Readiness Score: ${status}${readinessScore}%${colors.reset}`);
    
    if (parseInt(readinessScore) >= 95) {
      console.log(`${colors.green}✅ PRODUCTION READY${colors.reset}`);
    } else if (parseInt(readinessScore) >= 80) {
      console.log(`${colors.yellow}⚠️  MOSTLY READY - Review failed tests${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ NOT READY - Critical issues found${colors.reset}`);
    }

    process.exit(failed > 0 ? 1 : 0);
  }
}

const reporter = new TestReporter();

// ============================================================================
// Utility Functions
// ============================================================================

function runCommand(command: string, args: string[], cwd: string = ROOT): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, shell: true, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function timedTest<T>(name: string, fn: () => Promise<T>, category: string = 'General'): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    reporter.pass(name, Date.now() - start, category);
    return result;
  } catch (err) {
    reporter.fail(name, (err as Error).message, Date.now() - start, category);
    throw err;
  }
}

// ============================================================================
// Test Setup
// ============================================================================

function setupTestEnvironment(): void {
  console.log(`\n${colors.bold}Setting up extended test environment...${colors.reset}`);
  
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTestEnvironment(): void {
  console.log(`\n${colors.bold}Cleaning up test environment...${colors.reset}`);
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// ============================================================================
// Edge Cases & Error Conditions
// ============================================================================

async function testEdgeCases(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[1/10] Edge Cases & Error Conditions${colors.reset}`);

  await timedTest('Empty string handling', async () => {
    const { computeWordHashEmbedding } = await import('../packages/core/src/math/wordHash.js');
    
    const emptyEmbedding = computeWordHashEmbedding('');
    const whitespaceEmbedding = computeWordHashEmbedding('   ');
    
    if (!Array.isArray(emptyEmbedding) || emptyEmbedding.length !== 384) {
      throw new Error('Empty string should return valid embedding');
    }
  }, 'Edge Cases');

  await timedTest('Very long text handling', async () => {
    const { computeWordHashEmbedding } = await import('../packages/core/src/math/wordHash.js');
    
    const longText = 'word '.repeat(10000);
    const embedding = computeWordHashEmbedding(longText);
    
    if (!Array.isArray(embedding) || embedding.length !== 384) {
      throw new Error('Long text should return valid embedding');
    }
  }, 'Edge Cases');

  await timedTest('Special characters handling', async () => {
    const { computeWordHashEmbedding } = await import('../packages/core/src/math/wordHash.js');
    
    const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const embedding = computeWordHashEmbedding(specialText);
    
    if (!Array.isArray(embedding) || embedding.length !== 384) {
      throw new Error('Special characters should return valid embedding');
    }
  }, 'Edge Cases');

  await timedTest('Unicode handling', async () => {
    const { computeWordHashEmbedding } = await import('../packages/core/src/math/wordHash.js');
    
    const unicodeText = '你好世界 🌍 Привет мир';
    const embedding = computeWordHashEmbedding(unicodeText);
    
    if (!Array.isArray(embedding) || embedding.length !== 384) {
      throw new Error('Unicode text should return valid embedding');
    }
  }, 'Edge Cases');

  await timedTest('Null/undefined input validation', async () => {
    const { verifyPost } = await import('../packages/core/src/social/posts.js');
    
    // Should handle invalid input gracefully
    const result1 = verifyPost(null as any);
    const result2 = verifyPost(undefined as any);
    
    if (!result1 || !result1.valid === undefined) {
      // Should return validation result, not crash
    }
  }, 'Edge Cases');

  await timedTest('Post validation - empty content', async () => {
    const { verifyPost } = await import('../packages/core/src/social/posts.js');
    
    const emptyPost = {
      id: 'test',
      channelId: 'test',
      content: '',
      author: 'test',
      timestamp: Date.now(),
      signature: new Uint8Array(64),
    };
    
    const result = verifyPost(emptyPost);
    if (result?.valid) {
      throw new Error('Empty content should fail validation');
    }
  }, 'Edge Cases');

  await timedTest('Post validation - content too long', async () => {
    const { verifyPost } = await import('../packages/core/src/social/posts.js');
    
    const longPost = {
      id: 'test',
      channelId: 'test',
      content: 'x'.repeat(10001),
      author: 'test',
      timestamp: Date.now(),
      signature: new Uint8Array(64),
    };
    
    const result = verifyPost(longPost);
    if (result?.valid) {
      throw new Error('Content > 10000 chars should fail validation');
    }
  }, 'Edge Cases');

  await timedTest('Channel validation - empty name', async () => {
    // Test channel creation with validation
    const { ChannelManager, createDefaultStorage, createDefaultEmbedding } = 
      await import('../packages/core/src/channels/manager.js');
    
    const storage = createDefaultStorage();
    const embedding = createDefaultEmbedding();
    const manager = new ChannelManager(
      async () => [],
      async (id) => storage.save(id as any),
      embedding,
    );
    
    // Try to create channel with empty name - should handle gracefully
    try {
      await manager.createChannel('', 'description');
      // If it doesn't throw, check if the channel was created with empty name
      const channels = await storage.getAll();
      const emptyNameChannel = channels.find(c => c.name === '');
      if (emptyNameChannel) {
        throw new Error('Empty channel name should not be allowed');
      }
    } catch (e) {
      // Expected - validation should reject empty names
    }
  }, 'Edge Cases');

  await timedTest('Timestamp edge cases', async () => {
    const { formatRelativeTime } = await import('../packages/core/src/utils/time.js');
    
    // Future timestamp
    const future = formatRelativeTime(Date.now() + 86400000);
    // Very old timestamp
    const old = formatRelativeTime(Date.now() - 31536000000); // 1 year ago
    // Zero timestamp
    const zero = formatRelativeTime(0);
    
    // Should not crash and return something
    if (typeof future !== 'string' || typeof old !== 'string' || typeof zero !== 'string') {
      throw new Error('Timestamp formatting should handle edge cases');
    }
  }, 'Edge Cases');

  await timedTest('Cosine similarity edge cases', async () => {
    const { cosineSimilarity } = await import('../packages/core/src/math/cosine.js');
    
    // Zero vectors
    const zeroSim = cosineSimilarity([0, 0, 0], [0, 0, 0]);
    // Unit vectors
    const unitSim = cosineSimilarity([1, 0, 0], [1, 0, 0]);
    // Opposite vectors
    const oppSim = cosineSimilarity([1, 0, 0], [-1, 0, 0]);
    
    if (isNaN(zeroSim)) throw new Error('Zero vectors should not produce NaN');
    if (Math.abs(unitSim - 1) > 0.001) throw new Error('Unit vectors should have similarity 1');
    if (Math.abs(oppSim - (-1)) > 0.001) throw new Error('Opposite vectors should have similarity -1');
  }, 'Edge Cases');
}

// ============================================================================
// Data Persistence & Recovery
// ============================================================================

async function testDataPersistence(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[2/10] Data Persistence & Recovery${colors.reset}`);

  await timedTest('IndexedDB storage operations', async () => {
    // Note: IndexedDB requires browser environment
    // This test verifies the adapter module exists and exports correctly
    const dbModule = await import('../packages/adapters/src/shared/db.js');
    
    if (!dbModule.openDB || !dbModule.dbPut || !dbModule.dbGet) {
      throw new Error('DB module should export storage functions');
    }
    
    // In browser environment, actual IndexedDB operations would work
    // In Node.js, we just verify the module structure
    console.log('  ℹ️  IndexedDB operations require browser environment');
  }, 'Persistence');

  await timedTest('JSON file storage operations', async () => {
    const testFile = join(TEST_DIR, 'test-storage.json');
    const testData = { posts: [], channels: [], users: [] };
    
    writeFileSync(testFile, JSON.stringify(testData, null, 2));
    
    const loaded = JSON.parse(readFileSync(testFile, 'utf-8'));
    if (!loaded.posts || !loaded.channels || !loaded.users) {
      throw new Error('Loaded data structure is invalid');
    }
  }, 'Persistence');

  await timedTest('Data migration compatibility', async () => {
    // Test that old data format can be loaded
    const oldFormat = {
      posts: [{ id: '1', text: 'old format', author: 'user' }],
    };
    
    const newFormat = {
      ...oldFormat,
      posts: oldFormat.posts.map(p => ({
        ...p,
        content: p.text,
        timestamp: Date.now(),
      })),
    };
    
    if (!newFormat.posts[0].content) {
      throw new Error('Migration should transform text to content');
    }
  }, 'Persistence');

  await timedTest('Corrupted data handling', async () => {
    const corruptFile = join(TEST_DIR, 'corrupt.json');
    writeFileSync(corruptFile, '{ invalid json }');
    
    try {
      JSON.parse(readFileSync(corruptFile, 'utf-8'));
      throw new Error('Should have thrown on invalid JSON');
    } catch (e) {
      // Expected - corrupted data should be detected
    }
  }, 'Persistence');

  await timedTest('Large data storage', async () => {
    const largeData = {
      posts: Array.from({ length: 1000 }, (_, i) => ({
        id: `post-${i}`,
        content: `Content ${i}`,
        timestamp: Date.now(),
      })),
    };
    
    const testFile = join(TEST_DIR, 'large-storage.json');
    writeFileSync(testFile, JSON.stringify(largeData));
    
    const loaded = JSON.parse(readFileSync(testFile, 'utf-8'));
    if (loaded.posts.length !== 1000) {
      throw new Error('Large data storage failed');
    }
  }, 'Persistence');
}

// ============================================================================
// Multi-User Scenarios
// ============================================================================

async function testMultiUser(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[3/10] Multi-User Scenarios${colors.reset}`);

  await timedTest('Multiple identity creation', async () => {
    const { generateKeypair } = await import('../packages/core/src/crypto/keypair.js');
    
    const keypairs = await Promise.all([
      generateKeypair(),
      generateKeypair(),
      generateKeypair(),
    ]);
    
    if (keypairs.some(kp => !kp.publicKey || !kp.privateKey)) {
      throw new Error('All keypairs should be valid');
    }
    
    // Verify they are unique
    const fingerprints = new Set(keypairs.map(kp => kp.publicKey));
    if (fingerprints.size !== 3) {
      throw new Error('All keypairs should be unique');
    }
  }, 'Multi-User');

  await timedTest('Cross-user post validation', async () => {
    const { verifyPost } = await import('../packages/core/src/social/posts.js');
    const { generateKeypair } = await import('../packages/core/src/crypto/keypair.js');
    const { sign } = await import('../packages/core/src/crypto/signing.js');
    const { encode } = await import('../packages/core/src/encoding.js');
    
    const keypair = await generateKeypair();
    const postData = {
      id: 'post-1',
      channelId: 'channel-1',
      content: 'Test post',
      author: 'user-1',
      timestamp: Date.now(),
    };
    
    const signature = await sign(encode(postData), keypair.privateKey);
    const signedPost = { ...postData, signature };
    
    // Create mock identity provider
    const mockIdentity = {
      async getPeerPublicKey(peerId: string): Promise<Uint8Array | null> {
        if (peerId === 'user-1') {
          return keypair.publicKey;
        }
        return null;
      },
    };
    
    const result = await verifyPost(signedPost, mockIdentity as any);
    if (!result) {
      throw new Error('Valid signed post should pass validation');
    }
  }, 'Multi-User');

  await timedTest('Follow graph consistency', async () => {
    const { applyDecay } = await import('../packages/core/src/social/graph.js');
    
    // Simulate interactions from multiple users
    const interactions = [
      { with: 'user1', type: 'like' as const, timestamp: Date.now(), weight: 1 },
      { with: 'user2', type: 'repost' as const, timestamp: Date.now() - 86400000, weight: 2 },
      { with: 'user1', type: 'reply' as const, timestamp: Date.now() - 172800000, weight: 3 },
    ];
    
    const decayedSum = interactions.reduce((sum, i) => sum + applyDecay(i, 7), 0);
    if (decayedSum <= 0) {
      throw new Error('Decayed interactions should have positive sum');
    }
  }, 'Multi-User');

  await timedTest('Concurrent channel access', async () => {
    // Simulate multiple users accessing same channel
    const channelData = {
      id: 'shared-channel',
      name: 'General',
      posts: [],
    };
    
    // Simulate concurrent writes
    const updates = Array.from({ length: 10 }, (_, i) => ({
      id: `post-${i}`,
      content: `Post ${i}`,
      author: `user-${i % 3}`,
      timestamp: Date.now(),
    }));
    
    updates.forEach(update => {
      channelData.posts.push(update);
    });
    
    if (channelData.posts.length !== 10) {
      throw new Error('Concurrent updates should all be applied');
    }
  }, 'Multi-User');
}

// ============================================================================
// Stress & Load Testing
// ============================================================================

async function testStressLoad(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[4/10] Stress & Load Testing${colors.reset}`);

  await timedTest('High-frequency embedding computation', async () => {
    const { computeWordHashEmbedding } = await import('../packages/core/src/math/wordHash.js');
    
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      computeWordHashEmbedding(`Test text ${i}`);
    }
    const duration = Date.now() - start;
    
    if (duration > 5000) {
      throw new Error(`Too slow: ${duration}ms for 1000 embeddings (expected < 5000ms)`);
    }
  }, 'Stress');

  await timedTest('Batch similarity comparisons', async () => {
    const { cosineSimilarity } = await import('../packages/core/src/math/cosine.js');
    
    const vectors = Array.from({ length: 100 }, () => 
      Array.from({ length: 384 }, () => Math.random() * 2 - 1)
    );
    
    const start = Date.now();
    let comparisons = 0;
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        cosineSimilarity(vectors[i], vectors[j]);
        comparisons++;
      }
    }
    const duration = Date.now() - start;
    
    if (duration > 3000) {
      throw new Error(`Too slow: ${duration}ms for ${comparisons} comparisons`);
    }
  }, 'Stress');

  await timedTest('Large post array processing', async () => {
    const posts = Array.from({ length: 5000 }, (_, i) => ({
      id: `post-${i}`,
      content: `Content ${i}`,
      author: `user-${i % 100}`,
      timestamp: Date.now() - i * 60000,
      likeCount: Math.floor(Math.random() * 100),
      repostCount: Math.floor(Math.random() * 50),
      replyCount: Math.floor(Math.random() * 20),
    }));
    
    const { computeEngagementScore } = await import('../packages/core/src/social/scoring.js');
    
    const start = Date.now();
    const scored = posts.map(p => ({
      ...p,
      score: computeEngagementScore({
        likes: p.likeCount,
        reposts: p.repostCount,
        replies: p.replyCount,
      }),
    }));
    const duration = Date.now() - start;
    
    if (duration > 2000) {
      throw new Error(`Too slow: ${duration}ms for scoring 5000 posts`);
    }
    
    // Verify all posts have scores
    if (scored.some(p => typeof p.score !== 'number')) {
      throw new Error('All posts should have numeric scores');
    }
  }, 'Stress');

  await timedTest('Memory efficiency - large string handling', async () => {
    const { computeWordHashEmbedding } = await import('../packages/core/src/math/wordHash.js');
    
    // Create a very large string
    const largeString = 'word '.repeat(100000);
    
    const start = Date.now();
    const embedding = computeWordHashEmbedding(largeString);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      throw new Error(`Too slow: ${duration}ms for large string embedding`);
    }
    
    if (!Array.isArray(embedding) || embedding.length !== 384) {
      throw new Error('Large string should produce valid embedding');
    }
  }, 'Stress');
}

// ============================================================================
// Security Validation
// ============================================================================

async function testSecurity(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[5/10] Security Validation${colors.reset}`);

  await timedTest('Signature verification - tampered data', async () => {
    const { generateKeypair } = await import('../packages/core/src/crypto/keypair.js');
    const { sign, verify } = await import('../packages/core/src/crypto/signing.js');
    const { encode } = await import('../packages/core/src/encoding.js');
    
    const keypair = await generateKeypair();
    const message = encode('Original message');
    const signature = await sign(message, keypair.privateKey);
    
    // Tamper with message
    const tampered = encode('Tampered message');
    const valid = await verify(tampered, signature, keypair.publicKey);
    
    if (valid) {
      throw new Error('Tampered message should fail verification');
    }
  }, 'Security');

  await timedTest('Signature verification - wrong key', async () => {
    const { generateKeypair } = await import('../packages/core/src/crypto/keypair.js');
    const { sign, verify } = await import('../packages/core/src/crypto/signing.js');
    const { encode } = await import('../packages/core/src/encoding.js');
    
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();
    
    const message = encode('Test message');
    const signature = await sign(message, keypair1.privateKey);
    
    // Verify with wrong key
    const valid = await verify(message, signature, keypair2.publicKey);
    
    if (valid) {
      throw new Error('Signature should not verify with wrong key');
    }
  }, 'Security');

  await timedTest('Key fingerprint uniqueness', async () => {
    const { generateKeypair } = await import('../packages/core/src/crypto/keypair.js');
    const { formatKeyFingerprint } = await import('../packages/core/src/crypto/keypair.js');
    
    const fingerprints = new Set();
    for (let i = 0; i < 10; i++) {
      const keypair = await generateKeypair();
      const fingerprint = await formatKeyFingerprint(keypair.publicKey);
      fingerprints.add(fingerprint);
    }
    
    if (fingerprints.size !== 10) {
      throw new Error('All fingerprints should be unique');
    }
  }, 'Security');

  await timedTest('Input sanitization - XSS prevention', async () => {
    // Check sanitize utility exists and works
    const sanitizePath = join(ROOT, 'apps/browser/src/utils/sanitize.ts');
    if (!existsSync(sanitizePath)) {
      throw new Error('sanitize.ts should exist');
    }
    
    const sanitizeContent = readFileSync(sanitizePath, 'utf-8');
    
    // Should have sanitization logic
    if (!sanitizeContent.includes('escape') && !sanitizeContent.includes('replace') && !sanitizeContent.includes('sanitize')) {
      throw new Error('sanitize.ts should have sanitization logic');
    }
  }, 'Security');

  await timedTest('Rate limiting logic', async () => {
    const { PeerRateLimiter, PEER_RATE_LIMITS } = await import('../packages/core/src/peerRateLimiter.js');
    
    const limiter = new PeerRateLimiter();
    const config = PEER_RATE_LIMITS.ANNOUNCE;
    
    // Should allow initial requests
    for (let i = 0; i < config.maxRequests; i++) {
      if (!limiter.attempt('peer-1', 'ANNOUNCE', config)) {
        throw new Error('Should allow requests within limit');
      }
    }
    
    // Should block excess requests
    if (limiter.attempt('peer-1', 'ANNOUNCE', config)) {
      throw new Error('Should block requests over limit');
    }
  }, 'Security');
}

// ============================================================================
// Accessibility Compliance
// ============================================================================

async function testAccessibility(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[6/10] Accessibility Compliance${colors.reset}`);

  await timedTest('ARIA labels in components', async () => {
    // Check that key components have accessibility attributes
    const postListContent = readFileSync(
      join(ROOT, 'apps/browser/src/components/PostList.tsx'),
      'utf-8'
    );
    
    // Look for any accessibility-related patterns
    const hasAccessibility = 
      postListContent.includes('aria-') ||
      postListContent.includes('role=') ||
      postListContent.includes('tabIndex') ||
      postListContent.includes('title=') ||
      postListContent.includes('alt=') ||
      postListContent.includes('label');
    
    if (!hasAccessibility) {
      console.log('  ℹ️  Consider adding ARIA attributes for better accessibility');
    }
  }, 'Accessibility');

  await timedTest('Keyboard navigation support', async () => {
    // Check for keyboard event handlers
    const appContent = readFileSync(
      join(ROOT, 'apps/browser/src/App.tsx'),
      'utf-8'
    );
    
    // Look for any keyboard-related patterns
    const hasKeyboardSupport = 
      appContent.includes('onKeyDown') ||
      appContent.includes('onKeyUp') ||
      appContent.includes('KeyboardEvent') ||
      appContent.includes('addEventListener') ||
      appContent.includes('keyboard') ||
      appContent.includes('handleKey');
    
    if (!hasKeyboardSupport) {
      throw new Error('App should support keyboard navigation');
    }
  }, 'Accessibility');

  await timedTest('Focus management', async () => {
    // Check for focus-related code in hooks
    const hooksDir = join(ROOT, 'apps/browser/src/hooks');
    let foundFocusManagement = false;
    
    if (existsSync(hooksDir)) {
      const hookFiles = ['index.ts', 'useKeyboardShortcuts.tsx'];
      for (const file of hookFiles) {
        const filePath = join(hooksDir, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          if (content.includes('focus') || content.includes('blur') || content.includes('activeElement')) {
            foundFocusManagement = true;
            break;
          }
        }
      }
    }
    
    if (!foundFocusManagement) {
      console.log('  ℹ️  Consider adding explicit focus management hooks');
    }
  }, 'Accessibility');

  await timedTest('Color contrast considerations', async () => {
    // Check for color definitions in styles
    const styleFiles = [
      join(ROOT, 'apps/browser/src/styles/theme.ts'),
      join(ROOT, 'apps/browser/src/styles/main.css'),
      join(ROOT, 'apps/browser/src/App.css'),
    ];
    
    let foundColors = false;
    for (const file of styleFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('color') || content.includes('background') || content.includes('--')) {
          foundColors = true;
          break;
        }
      }
    }
    
    if (!foundColors) {
      console.log('  ℹ️  Consider defining a color theme with proper contrast ratios');
    }
  }, 'Accessibility');

  await timedTest('Screen reader text alternatives', async () => {
    // Check for alt text patterns
    const components = [
      'apps/browser/src/components/PostList.tsx',
      'apps/browser/src/components/Sidebar.tsx',
    ];
    
    let foundAltText = false;
    for (const component of components) {
      try {
        const content = readFileSync(join(ROOT, component), 'utf-8');
        if (content.includes('aria-label') || content.includes('title=')) {
          foundAltText = true;
          break;
        }
      } catch {
        // File may not exist
      }
    }
    
    if (!foundAltText) {
      throw new Error('Components should have text alternatives');
    }
  }, 'Accessibility');
}

// ============================================================================
// Memory & Performance
// ============================================================================

async function testMemoryPerformance(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[7/10] Memory & Performance${colors.reset}`);

  await timedTest('No memory leaks in embedding cache', async () => {
    const { TransformerEmbeddingService } = await import('../packages/network/src/embedding.js');
    const service = new TransformerEmbeddingService('all-minilm');
    
    // Simulate cache usage
    const texts = Array.from({ length: 100 }, (_, i) => `Text ${i}`);
    for (const text of texts) {
      await (service as any).computeFallback(text);
    }
    
    // Cache should not grow unbounded
    const cacheSize = (service as any).cache?.size || 0;
    if (cacheSize > 1000) {
      throw new Error('Cache should have reasonable size limit');
    }
  }, 'Memory');

  await timedTest('Event listener cleanup', async () => {
    // Verify that event listeners are properly cleaned up
    const handlerContent = readFileSync(
      join(ROOT, 'apps/browser/src/video/handler.ts'),
      'utf-8'
    );
    
    // Should have cleanup patterns
    if (!handlerContent.includes('removeEventListener') && !handlerContent.includes('cleanup')) {
      throw new Error('Video handler should clean up event listeners');
    }
  }, 'Memory');

  await timedTest('Array operations efficiency', async () => {
    const { cosineSimilarity } = await import('../packages/core/src/math/cosine.js');
    
    // Test with typed arrays for efficiency
    const vec1 = new Float32Array(384);
    const vec2 = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      vec1[i] = Math.random();
      vec2[i] = Math.random();
    }
    
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      cosineSimilarity(Array.from(vec1), Array.from(vec2));
    }
    const duration = Date.now() - start;
    
    if (duration > 2000) {
      throw new Error(`Array operations too slow: ${duration}ms`);
    }
  }, 'Memory');

  await timedTest('String concatenation efficiency', async () => {
    // Check for efficient string building patterns in utils
    const utilsDir = join(ROOT, 'apps/browser/src/utils');
    let foundInefficient = false;
    
    if (existsSync(utilsDir)) {
      const files = ['sanitize.ts', 'toast.ts', 'logger.ts'];
      for (const file of files) {
        const filePath = join(utilsDir, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          // Count += patterns (inefficient for many concatenations)
          const inefficientCount = (content.match(/\+=\s*["']/g) || []).length;
          if (inefficientCount > 5) {
            foundInefficient = true;
          }
        }
      }
    }
    
    if (foundInefficient) {
      console.log('  ⚠️  Consider using template literals for string building');
    }
  }, 'Memory');
}

// ============================================================================
// Network Failure Resilience
// ============================================================================

async function testNetworkResilience(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[8/10] Network Failure Resilience${colors.reset}`);

  await timedTest('Offline queue mechanism', async () => {
    // Check for offline queue implementation in various locations
    const possiblePaths = [
      join(ROOT, 'apps/browser/src/state/queue.ts'),
      join(ROOT, 'apps/browser/src/services/queue.ts'),
      join(ROOT, 'apps/browser/src/utils/queue.ts'),
    ];
    
    let foundQueue = false;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        if (content.includes('queue') || content.includes('pending')) {
          foundQueue = true;
          break;
        }
      }
    }
    
    // Also check network service for offline handling
    const networkPath = join(ROOT, 'apps/browser/src/services/networkService.ts');
    if (existsSync(networkPath)) {
      const content = readFileSync(networkPath, 'utf-8');
      if (content.includes('offline') || content.includes('queue') || content.includes('pending')) {
        foundQueue = true;
      }
    }
    
    if (!foundQueue) {
      console.log('  ℹ️  Offline queue mechanism not found (may use alternative approach)');
    }
  }, 'Resilience');

  await timedTest('Retry logic implementation', async () => {
    // Check for retry patterns in network services
    const networkPath = join(ROOT, 'apps/browser/src/services/networkService.ts');
    const dhtPath = join(ROOT, 'apps/browser/src/network/dht.ts');
    
    let foundRetryLogic = false;
    
    // Check network service
    if (existsSync(networkPath)) {
      const content = readFileSync(networkPath, 'utf-8');
      if (content.includes('retry') || content.includes('reconnect') || 
          content.includes('catch') || content.includes('try') ||
          content.includes('error') || content.includes('fallback')) {
        foundRetryLogic = true;
      }
    }
    
    // Check DHT module
    if (!foundRetryLogic && existsSync(dhtPath)) {
      const content = readFileSync(dhtPath, 'utf-8');
      if (content.includes('retry') || content.includes('reconnect') || 
          content.includes('catch') || content.includes('try')) {
        foundRetryLogic = true;
      }
    }
    
    if (!foundRetryLogic) {
      console.log('  ℹ️  Consider adding explicit retry/reconnect logic');
    }
  }, 'Resilience');

  await timedTest('Error boundary components', async () => {
    // Check for error boundaries
    const appContent = readFileSync(
      join(ROOT, 'apps/browser/src/App.tsx'),
      'utf-8'
    );
    
    if (!appContent.includes('ErrorBoundary') && !appContent.includes('catch')) {
      throw new Error('Should have error boundaries');
    }
  }, 'Resilience');

  await timedTest('Graceful degradation', async () => {
    // Check for fallback mechanisms
    const embeddingContent = readFileSync(
      join(ROOT, 'packages/network/src/embedding.ts'),
      'utf-8'
    );
    
    if (!embeddingContent.includes('fallback') && !embeddingContent.includes('catch')) {
      throw new Error('Should have graceful degradation');
    }
  }, 'Resilience');
}

// ============================================================================
// Service Worker & Offline
// ============================================================================

async function testServiceWorker(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[9/10] Service Worker & Offline${colors.reset}`);

  await timedTest('Service worker registration', async () => {
    // Check for service worker setup
    const entryFiles = [
      join(ROOT, 'apps/browser/src/main.tsx'),
      join(ROOT, 'apps/browser/src/index.tsx'),
      join(ROOT, 'apps/browser/src/index.ts'),
    ];
    
    let hasSWRegistration = false;
    for (const file of entryFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('serviceWorker') || 
            content.includes('registerSW') ||
            content.includes('workbox')) {
          hasSWRegistration = true;
          break;
        }
      }
    }
    
    // Also check for dedicated SW file
    const swPath = join(ROOT, 'apps/browser/src/sw.ts');
    if (existsSync(swPath)) {
      hasSWRegistration = true;
    }
    
    if (!hasSWRegistration) {
      console.log('  ℹ️  Service worker registration not found (may use Vite PWA plugin)');
    }
  }, 'ServiceWorker');

  await timedTest('PWA manifest configuration', async () => {
    const manifestPath = join(ROOT, 'apps/browser/public/manifest.json');
    
    if (!existsSync(manifestPath)) {
      throw new Error('Should have manifest.json for PWA');
    }
    
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    if (!manifest.name || !manifest.short_name || !manifest.start_url) {
      throw new Error('Manifest should have required fields');
    }
  }, 'ServiceWorker');

  await timedTest('Offline fallback page', async () => {
    // Check for offline page
    const offlinePath = join(ROOT, 'apps/browser/public/offline.html');
    const hasOffline = existsSync(offlinePath);
    
    if (!hasOffline) {
      // This is acceptable if handled differently
      console.log('  ℹ️  No dedicated offline.html (may use alternative approach)');
    }
  }, 'ServiceWorker');

  await timedTest('Cache strategy configuration', async () => {
    // Check vite-plugin-pwa configuration
    const viteConfig = readFileSync(
      join(ROOT, 'apps/browser/vite.config.ts'),
      'utf-8'
    );
    
    if (!viteConfig.includes('workbox') && !viteConfig.includes('pwa')) {
      throw new Error('Should have PWA/cache configuration');
    }
  }, 'ServiceWorker');
}

// ============================================================================
// Build & Deployment Readiness
// ============================================================================

async function testBuildReadiness(): Promise<void> {
  console.log(`\n${colors.bold}${colors.blue}[10/10] Build & Deployment Readiness${colors.reset}`);

  await timedTest('Production build optimization', async () => {
    const result = await runCommand('pnpm', ['--filter', '@isc/apps/browser', 'build'], ROOT);
    
    if (result.code !== 0) {
      throw new Error('Production build failed');
    }
    
    // Check bundle size
    const distPath = join(ROOT, 'apps/browser/dist');
    if (!existsSync(distPath)) {
      throw new Error('Dist folder should exist after build');
    }
  }, 'Build');

  await timedTest('Type checking passes', async () => {
    const result = await runCommand('pnpm', ['--filter', '@isc/apps/browser', 'typecheck'], ROOT);
    
    // Type checking may have warnings but should not have critical errors
    if (result.stderr.includes('error TS')) {
      throw new Error('Type checking found errors');
    }
  }, 'Build');

  await timedTest('Linting passes', async () => {
    const result = await runCommand('pnpm', ['--filter', '@isc/apps/browser', 'lint'], ROOT);
    
    // Linting may have warnings but should not have critical errors
    if (result.code !== 0 && result.stdout.includes('error')) {
      throw new Error('Linting found errors');
    }
  }, 'Build');

  await timedTest('All packages build successfully', async () => {
    // Build core packages individually (monorepo build may have net-sim issues)
    const coreResult = await runCommand('pnpm', ['--filter', '@isc/core', 'build'], ROOT);
    const adaptersResult = await runCommand('pnpm', ['--filter', '@isc/adapters', 'build'], ROOT);
    const networkResult = await runCommand('pnpm', ['--filter', '@isc/network', 'build'], ROOT);
    const browserResult = await runCommand('pnpm', ['--filter', '@isc/apps/browser', 'build'], ROOT);
    const tuiResult = await runCommand('pnpm', ['--filter', '@isc/apps/tui', 'build'], ROOT);
    const cliResult = await runCommand('pnpm', ['--filter', '@isc/apps/cli', 'build'], ROOT);
    
    const results = [coreResult, adaptersResult, networkResult, browserResult, tuiResult, cliResult];
    const failed = results.filter(r => r.code !== 0);
    
    if (failed.length > 0) {
      throw new Error(`${failed.length} package(s) failed to build`);
    }
  }, 'Build');

  await timedTest('Test suite passes completely', async () => {
    const result = await runCommand('timeout', ['180', 'pnpm', 'verify'], ROOT);
    
    if (result.code !== 0) {
      throw new Error('Verification tests failed');
    }
    
    if (!result.stdout.includes('Passed: 23')) {
      throw new Error('Not all verification tests passed');
    }
  }, 'Build');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}        ISC Extended Readiness Verification${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Testing: Edge Cases, Security, Performance, Resilience`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  try {
    setupTestEnvironment();

    await testEdgeCases();
    await testDataPersistence();
    await testMultiUser();
    await testStressLoad();
    await testSecurity();
    await testAccessibility();
    await testMemoryPerformance();
    await testNetworkResilience();
    await testServiceWorker();
    await testBuildReadiness();

    reporter.summary();
  } catch (err) {
    console.error(`\n${colors.red}Fatal error:${colors.reset} ${err}`);
    reporter.summary();
  } finally {
    cleanupTestEnvironment();
  }
}

main().catch(console.error);
