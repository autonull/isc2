/**
 * Semantic Map Service - Legacy Compatibility Layer
 *
 * @deprecated Use the modular semantic-map module instead:
 * - SemanticMapService for map management
 * - SemanticLayoutService for layout calculations
 * - SemanticMapRenderer for rendering
 */

import { SemanticMapService } from './semantic-map/services/SemanticMapService.js';
import { projectTo2D as projectFn, findNeighbors as findFn } from './semantic-map/services/SemanticLayoutService.js';
import { kmeansClusters as kmeansFn } from './semantic-map/algorithms/clustering.js';
import { renderToSVG } from './semantic-map/renderer/SemanticMapRenderer.js';
import type { Point2D } from './semantic-map/types/semanticMap.js';
import type { Channel } from '@isc/core/types';

const service = new SemanticMapService();

export type { Point2D };

/**
 * Project high-dimensional embedding to 2D
 */
export function projectTo2D(embedding: number[], referencePoints: Point2D[]): Point2D {
  return projectFn(embedding, referencePoints);
}

/**
 * Compute 2D positions for channels
 */
export async function computeChannelPositions(channels: Channel[]): Promise<Point2D[]> {
  return service.computeMap(channels);
}

/**
 * Find semantic neighbors in 2D space
 */
export function findNeighbors(
  point: Point2D,
  allPoints: Point2D[],
  radius: number = 0.3
): Point2D[] {
  return findFn(point, allPoints, radius);
}

/**
 * Compute cluster centers using k-means
 */
export function kmeansClusters(
  points: Point2D[],
  k: number,
  maxIterations: number = 20
): Point2D[] {
  return kmeansFn(points, k, maxIterations);
}

/**
 * SVG/Canvas rendering helpers
 */
export function renderSemanticMap(
  points: Point2D[],
  container: HTMLElement,
  options: {
    onPointClick?: (point: Point2D) => void;
    showLabels?: boolean;
  } = {}
): void {
  service.clear();
  // Force update points in service before render
  points.forEach(p => service.addPoint(p));
  
  const svg = service.renderToSVG(container, {
    showLabels: options.showLabels,
  });

  // Add click handlers
  if (options.onPointClick) {
    const circles = svg.querySelectorAll('circle');
    circles.forEach((circle, i) => {
      circle.addEventListener('click', () => {
        if (points[i]) {
          options.onPointClick!(points[i]);
        }
      });
    });
  }

  // ensure the returned root element is actually in the container for tests to find
  if (!container.contains(svg)) {
    container.appendChild(svg);
  }
}
