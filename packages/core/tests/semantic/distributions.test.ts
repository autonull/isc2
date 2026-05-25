/* eslint-disable */
import { describe, it, expect } from 'vitest';
import {
  computeRelationalDistributions,
  type EmbeddingModel,
} from '../../src/semantic/distributions.js';
import type { Channel } from '../../src/index.js';

describe('computeRelationalDistributions', () => {
  const createMockModel = (vectors: Map<string, number[]>): EmbeddingModel => ({
    embed: async (text: string): Promise<number[]> => {
      const vec = vectors.get(text);
      if (!vec) {
        // Generate a deterministic vector based on text hash
        const hash = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const dim = 384;
        const vec2 = Array.from({ length: dim }, (_, i) => Math.sin(hash + i * 9999));
        const norm = Math.sqrt(vec2.reduce((s, v) => s + v * v, 0));
        return vec2.map((v) => v / norm);
      }
      return vec;
    },
  });

  it('should compute root distribution from channel description', async () => {
    const channel: Channel = {
      id: 'ch_1',
      name: 'Test',
      description: 'AI and machine learning discussions',
      spread: 0.1,
      relations: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
    };

    const model = createMockModel(new Map());
    const distributions = await computeRelationalDistributions(channel, model);

    expect(distributions).toHaveLength(1);
    expect(distributions[0].tag).toBe('root');
    expect(distributions[0].weight).toBe(1.0);
    expect(distributions[0].mu).toBeDefined();
    expect(distributions[0].mu.length).toBe(384);
  });

  it('should compute fused distributions for each relation', async () => {
    const channel: Channel = {
      id: 'ch_1',
      name: 'Test',
      description: 'AI discussions',
      spread: 0.1,
      relations: [
        { tag: 'topic', object: 'AI', weight: 1.5 },
        { tag: 'location', object: 'Tokyo', weight: 1.2 },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
    };

    const model = createMockModel(new Map());
    const distributions = await computeRelationalDistributions(channel, model);

    // Root + 2 relations = 3 distributions
    expect(distributions).toHaveLength(3);

    const topicDist = distributions.find((d) => d.tag === 'topic');
    const locationDist = distributions.find((d) => d.tag === 'location');

    expect(topicDist).toBeDefined();
    expect(topicDist?.weight).toBe(1.5);
    expect(topicDist?.sigma).toBeCloseTo(0.1 / 1.5, 2); // spread / weight

    expect(locationDist).toBeDefined();
    expect(locationDist?.weight).toBe(1.2);
  });

  it('should use default spread when not provided', async () => {
    const channel: Channel = {
      id: 'ch_1',
      name: 'Test',
      description: 'Test channel',
      spread: undefined as unknown as number,
      relations: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
    };

    const model = createMockModel(new Map());
    const distributions = await computeRelationalDistributions(channel, model);

    expect(distributions[0].sigma).toBe(0.1); // DEFAULT_SPREAD
  });

  it('should use default weight for relations without weight', async () => {
    const channel: Channel = {
      id: 'ch_1',
      name: 'Test',
      description: 'Test',
      spread: 0.1,
      relations: [
        { tag: 'topic', object: 'AI' }, // No weight
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
    };

    const model = createMockModel(new Map());
    const distributions = await computeRelationalDistributions(channel, model);

    const topicDist = distributions.find((d) => d.tag === 'topic');
    expect(topicDist?.weight).toBe(1.0); // Default weight
  });

  it('should return normalized vectors', async () => {
    const channel: Channel = {
      id: 'ch_1',
      name: 'Test',
      description: 'Test',
      spread: 0.1,
      relations: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
    };

    const model = createMockModel(new Map());
    const distributions = await computeRelationalDistributions(channel, model);

    for (const dist of distributions) {
      const norm = Math.sqrt(dist.mu.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 2);
    }
  });
});
