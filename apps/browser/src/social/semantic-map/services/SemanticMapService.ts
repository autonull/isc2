/**
 * Semantic Map Service
 *
 * Orchestrates semantic map computation and rendering.
 */

import type { Channel } from '@isc/core/types';
import type { Point2D } from '../types/semanticMap.js';
import { computeChannelPositions } from './SemanticLayoutService.js';
import { findNeighbors } from './SemanticLayoutService.js';
import { kmeansClusters } from '../algorithms/clustering.js';
import { renderToSVG, renderToCanvas, clearContainer } from '../renderer/SemanticMapRenderer.js';

export interface SemanticMapOptions {
  showLabels?: boolean;
  showConnections?: boolean;
  clusterCount?: number;
  neighborRadius?: number;
}

export class SemanticMapService {
  private points: Point2D[] = [];
  private clusters: Point2D[] = [];

  /**
   * Compute semantic map from channels
   */
  async computeMap(channels: Channel[]): Promise<Point2D[]> {
    this.points = await computeChannelPositions(channels);
    return this.points;
  }

  /**
   * Get computed points
   */
  getPoints(): Point2D[] {
    return this.points;
  }

  /**
   * Compute clusters
   */
  computeClusters(k: number): Point2D[] {
    this.clusters = kmeansClusters(this.points, k);
    return this.clusters;
  }

  /**
   * Get clusters
   */
  getClusters(): Point2D[] {
    return this.clusters;
  }

  /**
   * Find neighbors for a point
   */
  findNeighborsForPoint(point: Point2D, radius?: number): Point2D[] {
    return findNeighbors(point, this.points, radius);
  }

  /**
   * Render map to SVG
   */
  renderToSVG(
    container: HTMLElement,
    options: SemanticMapOptions = {}
  ): SVGSVGElement {
    clearContainer(container);
    return renderToSVG(this.points, container, {
      showLabels: options.showLabels,
      showConnections: options.showConnections,
    });
  }

  /**
   * Render map to canvas
   */
  renderToCanvas(
    canvas: HTMLCanvasElement,
    options: SemanticMapOptions = {}
  ): void {
    renderToCanvas(this.points, canvas, {
      showLabels: options.showLabels,
      showConnections: options.showConnections,
    });
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.points = [];
    this.clusters = [];
  }
}
