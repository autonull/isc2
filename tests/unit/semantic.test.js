/**
 * Unit Tests for Semantic Matching
 */
import { describe, it, expect } from 'vitest';
import { computeRelationalDistributions, matchDistributions, } from '../src/semantic/index.js';
describe('Semantic Matching', () => {
    describe('computeRelationalDistributions', () => {
        it('should compute root distribution from channel description', async () => {
            const channel = {
                id: 'ch_test',
                name: 'Test Channel',
                description: 'AI ethics and machine learning',
                spread: 0.1,
                relations: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: true,
            };
            const distributions = await computeRelationalDistributions(channel);
            expect(distributions.length).toBe(1);
            expect(distributions[0].type).toBe('root');
            expect(distributions[0].mu.length).toBe(384);
            expect(distributions[0].sigma).toBe(0.1);
        });
        it('should compute fused distributions for relations', async () => {
            const channel = {
                id: 'ch_test',
                name: 'Test Channel',
                description: 'AI ethics',
                spread: 0.1,
                relations: [
                    {
                        tag: 'in_location',
                        object: 'lat:35.6895, long:139.6917',
                        weight: 1.0,
                    },
                    {
                        tag: 'with_mood',
                        object: 'reflective',
                        weight: 1.2,
                    },
                ],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: true,
            };
            const distributions = await computeRelationalDistributions(channel);
            expect(distributions.length).toBe(3); // root + 2 relations
            expect(distributions[1].type).toBe('fused');
            expect(distributions[1].tag).toBe('in_location');
            expect(distributions[2].type).toBe('fused');
            expect(distributions[2].tag).toBe('with_mood');
        });
        it('should limit relations to maximum of 5', async () => {
            const channel = {
                id: 'ch_test',
                name: 'Test Channel',
                description: 'Test',
                spread: 0.1,
                relations: [
                    { tag: 'in_location', object: 'loc1' },
                    { tag: 'during_time', object: 'time1' },
                    { tag: 'with_mood', object: 'mood1' },
                    { tag: 'under_domain', object: 'domain1' },
                    { tag: 'causes_effect', object: 'effect1' },
                    { tag: 'part_of', object: 'part1' }, // This should be ignored
                ],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: true,
            };
            const distributions = await computeRelationalDistributions(channel);
            expect(distributions.length).toBeLessThanOrEqual(6); // root + max 5 relations
        });
        it('should apply weight to fused distribution sigma', async () => {
            const channel = {
                id: 'ch_test',
                name: 'Test Channel',
                description: 'Test',
                spread: 0.2,
                relations: [
                    {
                        tag: 'with_mood',
                        object: 'mood',
                        weight: 2.0,
                    },
                ],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: true,
            };
            const distributions = await computeRelationalDistributions(channel);
            expect(distributions[1].sigma).toBe(0.1); // 0.2 / 2.0
        });
    });
    describe('matchDistributions', () => {
        it('should match identical distributions with high similarity', async () => {
            const dist1 = {
                type: 'root',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
            };
            const dist2 = {
                type: 'root',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
            };
            const matches = await matchDistributions([dist1], [dist2]);
            expect(matches.overallSimilarity).toBeCloseTo(1, 5);
        });
        it('should handle different distribution types', async () => {
            const dist1 = {
                type: 'root',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
            };
            const dist2 = {
                type: 'fused',
                tag: 'in_location',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
                weight: 1.0,
            };
            const matches = await matchDistributions([dist1], [dist2]);
            expect(matches.overallSimilarity).toBeGreaterThan(0);
        });
        it('should weight matched relations higher', async () => {
            const rootDist = {
                type: 'root',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
            };
            const fusedDist = {
                type: 'fused',
                tag: 'in_location',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
                weight: 1.5,
            };
            const dists1 = [rootDist, fusedDist];
            const dists2 = [rootDist, fusedDist];
            const matches = await matchDistributions(dists1, dists2);
            expect(matches.overallSimilarity).toBeCloseTo(1, 5);
        });
        it('should return empty matches for empty distributions', async () => {
            const matches = await matchDistributions([], []);
            expect(matches.overallSimilarity).toBe(0);
            expect(matches.alignments.length).toBe(0);
        });
        it('should handle different sized distribution sets', async () => {
            const dist1 = {
                type: 'root',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
            };
            const dist2 = {
                type: 'root',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
            };
            const dist3 = {
                type: 'fused',
                tag: 'in_location',
                mu: [0.5, 0.5, 0.5],
                sigma: 0.1,
                weight: 1.0,
            };
            const matches = await matchDistributions([dist1], [dist2, dist3]);
            expect(matches.overallSimilarity).toBeGreaterThan(0);
        });
    });
    describe('Integration: End-to-End Semantic Matching', () => {
        it('should find similar channels', async () => {
            const channel1 = {
                id: 'ch1',
                name: 'AI Ethics',
                description: 'Ethical implications of artificial intelligence',
                spread: 0.1,
                relations: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: true,
            };
            const channel2 = {
                id: 'ch2',
                name: 'Machine Learning Ethics',
                description: 'Ethics in machine learning systems',
                spread: 0.1,
                relations: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: true,
            };
            const dists1 = await computeRelationalDistributions(channel1);
            const dists2 = await computeRelationalDistributions(channel2);
            const matches = await matchDistributions(dists1, dists2);
            // Similar topics should have high similarity
            expect(matches.overallSimilarity).toBeGreaterThan(0.6);
        });
        it('should distinguish different topics', async () => {
            const channel1 = {
                id: 'ch1',
                name: 'AI Ethics',
                description: 'Ethical implications of artificial intelligence',
                spread: 0.1,
                relations: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: true,
            };
            const channel2 = {
                id: 'ch2',
                name: 'Cooking Recipes',
                description: 'Delicious recipes from around the world',
                spread: 0.1,
                relations: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: true,
            };
            const dists1 = await computeRelationalDistributions(channel1);
            const dists2 = await computeRelationalDistributions(channel2);
            const matches = await matchDistributions(dists1, dists2);
            // Different topics should have lower similarity
            expect(matches.overallSimilarity).toBeLessThan(0.5);
        });
    });
});
//# sourceMappingURL=semantic.test.js.map