/* eslint-disable */
/**
 * Semantic Map Tests
 */

import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '@isc/core/math';

describe('Semantic Map', () => {
  describe('projectTo2D', () => {
    it('should project high-dimensional embedding to 2D', async () => {
      const { projectTo2D } = await import('../../src/social/semanticMap');

      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const referencePoints = [
        { x: 0, y: 0, data: { embedding: [0.1, 0.1, 0.1, 0.1, 0.1] } },
        { x: 1, y: 0, data: { embedding: [0.2, 0.2, 0.2, 0.2, 0.2] } },
        { x: 0, y: 1, data: { embedding: [0.3, 0.3, 0.3, 0.3, 0.3] } },
      ];

      const point = projectTo2D(embedding, referencePoints);

      expect(point.x).toBeDefined();
      expect(point.y).toBeDefined();
      expect(typeof point.x).toBe('number');
      expect(typeof point.y).toBe('number');
    });

    it('should return origin for empty reference points', async () => {
      const { projectTo2D } = await import('../../src/social/semanticMap');

      const embedding = [0.1, 0.2, 0.3];
      const point = projectTo2D(embedding, []);

      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    });
  });

  describe('computeChannelPositions', () => {
    it('should compute 2D positions for channels', async () => {
      const { computeChannelPositions } = await import('../../src/social/semanticMap');

      const channels = [
        { id: 'ch1', name: 'Channel 1', distributions: [{ mu: [0.1, 0.2, 0.3], sigma: [0.1, 0.1, 0.1] }] },
        { id: 'ch2', name: 'Channel 2', distributions: [{ mu: [0.4, 0.5, 0.6], sigma: [0.1, 0.1, 0.1] }] },
        { id: 'ch3', name: 'Channel 3', distributions: [{ mu: [0.7, 0.8, 0.9], sigma: [0.1, 0.1, 0.1] }] },
      ];

      const positions = await computeChannelPositions(channels as any);

      expect(positions).toHaveLength(3);
      positions.forEach(p => {
        expect('x' in p).toBe(true);
        expect('y' in p).toBe(true);
        expect('data' in p).toBe(true);
      });
    });

    it('should return empty array for no channels', async () => {
      const { computeChannelPositions } = await import('../../src/social/semanticMap');

      const positions = await computeChannelPositions([]);
      expect(positions).toEqual([]);
    });
  });

  describe('findNeighbors', () => {
    it('should find neighbors within radius', async () => {
      const { findNeighbors } = await import('../../src/social/semanticMap');

      const center = { x: 0, y: 0, data: null };
      const points = [
        { x: 0.1, y: 0.1, data: null }, // Close
        { x: 0.2, y: 0.2, data: null }, // Within radius 0.3
        { x: 0.5, y: 0.5, data: null }, // Outside radius
        { x: -0.1, y: 0.1, data: null }, // Close
      ];

      const neighbors = findNeighbors(center, points, 0.3);

      expect(neighbors.length).toBe(3); // All except the far one
    });

    it('should exclude the center point', async () => {
      const { findNeighbors } = await import('../../src/social/semanticMap');

      const center = { x: 0, y: 0, data: null };
      const points = [center, { x: 0.1, y: 0.1, data: null }];

      const neighbors = findNeighbors(center, points, 0.5);

      expect(neighbors).not.toContain(center);
    });
  });

  describe('kmeansClusters', () => {
    it('should cluster points into k groups', async () => {
      const { kmeansClusters } = await import('../../src/social/semanticMap');

      // Create 3 distinct clusters
      const points = [
        { x: 0, y: 0, data: null },
        { x: 0.1, y: 0.1, data: null },
        { x: 0.2, y: 0.2, data: null },
        { x: 1, y: 1, data: null },
        { x: 1.1, y: 1.1, data: null },
        { x: 1.2, y: 1.2, data: null },
      ];

      const centroids = kmeansClusters(points, 2);

      expect(centroids).toHaveLength(2);
      centroids.forEach(c => {
        expect('x' in c).toBe(true);
        expect('y' in c).toBe(true);
      });
    });

    it('should handle fewer points than k', async () => {
      const { kmeansClusters } = await import('../../src/social/semanticMap');

      const points = [{ x: 0, y: 0, data: null }];
      const centroids = kmeansClusters(points, 3);

      expect(centroids).toHaveLength(1);
    });
  });

  describe('renderSemanticMap', () => {
    it('should create SVG element for visualization', async () => {
      const { renderSemanticMap } = await import('../../src/social/semanticMap');

      const points = [
        { x: 0, y: 0, data: { name: 'Point 1' } },
        { x: 0.5, y: 0.5, data: { name: 'Point 2' } },
      ];

      const container = document.createElement('div');
      renderSemanticMap(points, container, { showLabels: true });

      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(2);

      const texts = container.querySelectorAll('text');
      expect(texts.length).toBe(2);
    });

    it('should handle click events', async () => {
      const { renderSemanticMap } = await import('../../src/social/semanticMap');

      const points = [{ x: 0, y: 0, data: { name: 'Clickable' } }];
      const container = document.createElement('div');
      const onPointClick = vi.fn();

      renderSemanticMap(points, container, { onPointClick });

      const circle = container.querySelector('circle');
      circle?.dispatchEvent(new MouseEvent('click'));

      expect(onPointClick).toHaveBeenCalled();
    });
  });
});
