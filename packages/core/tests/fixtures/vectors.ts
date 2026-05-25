/* eslint-disable */
/**
 * Pre-computed embedding vectors for testing.
 *
 * These fixtures provide deterministic, known vectors for testing
 * similarity computations, LSH, and matching algorithms.
 */

import type { Channel, Distribution } from '../../src/index.js';

/**
 * Generates a deterministic unit vector from a seed string.
 */
export function generateEmbedding(seed: string, dimensions: number = 384): number[] {
  const values: number[] = [];
  let hash = hashString(seed);

  for (let i = 0; i < dimensions; i++) {
    const x = Math.sin(hash + i * 9999) * 10000;
    values.push(x - Math.floor(x));
  }

  // Normalize to unit vector
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return values.map((v) => v / norm);
}

/**
 * Simple string hash for deterministic generation.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Pre-generated test vectors
export const VECTORS = {
  // Similar vectors (cosine similarity should be high)
  similarA: generateEmbedding('test-similar-a'),
  similarB: generateEmbedding('test-similar-b'),
  similarC: generateEmbedding('test-similar-c'),

  // Orthogonal vectors (cosine similarity should be ~0)
  orthogonalA: generateEmbedding('test-orthogonal-a'),
  orthogonalB: generateEmbedding('test-orthogonal-b'),

  // Opposite vectors (cosine similarity should be ~-1)
  oppositeA: generateEmbedding('test-opposite-a'),
  oppositeB: generateEmbedding('test-opposite-b').map((v) => -v),

  // Near-zero vector
  nearZero: generateEmbedding('test-near-zero').map((v) => v * 0.001),

  // Random unit vectors (various)
  random1: generateEmbedding('random-seed-1'),
  random2: generateEmbedding('random-seed-2'),
  random3: generateEmbedding('random-seed-3'),
  random4: generateEmbedding('random-seed-4'),
  random5: generateEmbedding('random-seed-5'),

  // Pre-computed known similarity pairs
  identical: generateEmbedding('identical-seed'),

  // Channel-specific vectors
  techChannel: generateEmbedding('channel-tech-ai'),
  aiChannel: generateEmbedding('channel-ai-ml'),
  ethicsChannel: generateEmbedding('channel-ethics'),
  tokyoChannel: generateEmbedding('channel-tokyo'),
  osakaChannel: generateEmbedding('channel-osaka'),
} as const;

// Sample channels for testing
export const CHANNELS = {
  aiEthics: {
    id: 'ch_test_1',
    name: 'AI Ethics',
    description: 'Ethical implications of artificial intelligence and machine learning',
    spread: 0.1,
    relations: [
      { tag: 'in_location', object: 'lat:35.6762,long:139.6503,radius:50km', weight: 1.2 },
      { tag: 'topic', object: 'AI', weight: 1.5 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    active: true,
  } as Channel,

  tokyoTech: {
    id: 'ch_test_2',
    name: 'Tokyo Tech',
    description: 'Technology discussions in Tokyo',
    spread: 0.15,
    relations: [
      { tag: 'in_location', object: 'lat:35.6762,long:139.6503,radius:30km', weight: 1.5 },
      { tag: 'topic', object: 'Technology', weight: 1.0 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    active: true,
  } as Channel,

  general: {
    id: 'ch_test_3',
    name: 'General Chat',
    description: 'General conversation channel',
    spread: 0.2,
    relations: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    active: true,
  } as Channel,
} as const;

// Sample distributions for matching tests
export const DISTRIBUTIONS = {
  aiEthics: {
    root: { mu: VECTORS.aiChannel, sigma: 0.1, tag: 'root', weight: 1.0 },
  } as { root: Distribution },

  tokyoTech: {
    root: { mu: VECTORS.tokyoChannel, sigma: 0.1, tag: 'root', weight: 1.0 },
  } as { root: Distribution },
};

// Mock cryptographic keys for testing (not real keys - for testing only)
export const MOCK_KEYS = {
  // Ed25519 test keypair (public key only - for verification)
  testPublicKey: new Uint8Array([
    0x9a, 0xad, 0xfa, 0x1e, 0xc4, 0x72, 0x3f, 0x3e, 0x7a, 0x5c, 0x6d, 0x4f, 0x1a, 0x6c, 0x3e, 0x6b,
    0xf4, 0x1a, 0x3b, 0x7d, 0x3e, 0x1c, 0x4b, 0x7d, 0x2e, 0x1c, 0x3d, 0x7e, 0x4a, 0x6f, 0x3d, 0x5c,
  ]),

  // Another test keypair
  testPublicKey2: new Uint8Array([
    0xbb, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf1, 0x23, 0x45, 0x67, 0x89, 0xab,
    0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf1, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd,
  ]),
};

// Location fixtures for spatiotemporal testing
export const LOCATIONS = {
  tokyo: { lat: 35.6762, lon: 139.6503, radius: 50 },
  osaka: { lat: 34.6937, lon: 135.5023, radius: 30 },
  shibuya: { lat: 35.6595, lon: 139.7004, radius: 10 },
  nearTokyo: { lat: 35.7, lon: 139.7, radius: 20 },
  farAway: { lat: 40.7128, lon: -74.006, radius: 50 }, // New York
} as const;

// Time window fixtures
export const TIME_WINDOWS = {
  now: {
    start: Date.now() - 3600000,
    end: Date.now() + 3600000,
  },
  today: {
    start: new Date().setHours(0, 0, 0, 0),
    end: new Date().setHours(23, 59, 59, 999),
  },
  thisWeek: {
    start: Date.now() - 7 * 24 * 3600000,
    end: Date.now(),
  },
  farFuture: {
    start: Date.now() + 30 * 24 * 3600000,
    end: Date.now() + 31 * 24 * 3600000,
  },
} as const;

// LSH test parameters
export const LSH_PARAMS = {
  numHashes: 10,
  hashLen: 32,
  seed: 'test-lsh-seed',
} as const;
