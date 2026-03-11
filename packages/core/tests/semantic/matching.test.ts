import { describe, it, expect } from 'vitest';
import {
  relationalMatch,
  distributionSimilarity,
  rankCandidates,
} from '../../src/semantic/matching.js';
import type { Distribution } from '../../src/index.js';
import { VECTORS } from '../fixtures/vectors.js';

describe('relationalMatch', () => {
  describe('root-only alignment', () => {
    it('should return root cosine similarity when only root distributions provided', () => {
      const myDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];
      const peerDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];

      const score = relationalMatch(myDists, peerDists);
      expect(score).toBeCloseTo(1.0, 2);
    });

    it('should return lower score for opposite root vectors', () => {
      const myDists: Distribution[] = [
        { mu: VECTORS.oppositeA, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];
      const peerDists: Distribution[] = [
        { mu: VECTORS.oppositeB, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];

      const score = relationalMatch(myDists, peerDists);
      expect(score).toBe(0);
    });
  });

  describe('tag-match bonus', () => {
    it('should apply bonus for matching relation tags', () => {
      const myDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
        { mu: VECTORS.similarB, sigma: 0.15, tag: 'topic', weight: 1.2 },
      ];
      const peerDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
        { mu: VECTORS.similarB, sigma: 0.12, tag: 'topic', weight: 1.2 },
      ];

      const score = relationalMatch(myDists, peerDists);
      expect(score).toBeGreaterThan(0.8);
    });
  });

  describe('weight scaling', () => {
    it('should scale score by relation weight', () => {
      const lowWeight: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
        { mu: VECTORS.similarB, sigma: 0.15, tag: 'topic', weight: 0.5 },
      ];
      const highWeight: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
        { mu: VECTORS.similarB, sigma: 0.15, tag: 'topic', weight: 2.0 },
      ];
      const peerDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
        { mu: VECTORS.similarB, sigma: 0.12, tag: 'topic', weight: 1.0 },
      ];

      const lowScore = relationalMatch(lowWeight, peerDists);
      const highScore = relationalMatch(highWeight, peerDists);
      expect(highScore).toBeGreaterThanOrEqual(lowScore);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for empty peer dists', () => {
      const myDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];
      expect(relationalMatch(myDists, [])).toBe(0);
    });

    it('should return 0 for empty my dists', () => {
      const peerDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];
      expect(relationalMatch([], peerDists)).toBe(0);
    });

    it('should return 0 when vectors are opposite', () => {
      const myDists: Distribution[] = [
        { mu: VECTORS.oppositeA, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];
      const peerDists: Distribution[] = [
        { mu: VECTORS.oppositeB, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];
      expect(relationalMatch(myDists, peerDists)).toBe(0);
    });
  });

  describe('score normalization', () => {
    it('should always return score in [0, 1]', () => {
      const myDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];
      const peerDists: Distribution[] = [
        { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
      ];
      const score = relationalMatch(myDists, peerDists);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

describe('distributionSimilarity', () => {
  it('should return cosine similarity between distribution means', () => {
    const distA: Distribution = { mu: VECTORS.similarA, sigma: 0.1 };
    const distB: Distribution = { mu: VECTORS.similarA, sigma: 0.1 };
    expect(distributionSimilarity(distA, distB)).toBeCloseTo(1.0, 2);
  });
});

describe('rankCandidates', () => {
  it('should rank candidates by score descending', () => {
    const myDists: Distribution[] = [
      { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
    ];
    const candidates: Distribution[][] = [
      [{ mu: VECTORS.orthogonalA, sigma: 0.1, tag: 'root', weight: 1.0 }],
      [{ mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 }],
      [{ mu: VECTORS.similarB, sigma: 0.1, tag: 'root', weight: 1.0 }],
    ];
    const ranked = rankCandidates(myDists, candidates);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
    expect(ranked[0].peerIndex).toBe(1);
  });

  it('should handle empty candidates', () => {
    const myDists: Distribution[] = [
      { mu: VECTORS.similarA, sigma: 0.1, tag: 'root', weight: 1.0 },
    ];
    expect(rankCandidates(myDists, [])).toHaveLength(0);
  });
});
