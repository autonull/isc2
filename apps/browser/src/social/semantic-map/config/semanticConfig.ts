/* eslint-disable */
/**
 * Semantic Map Configuration
 *
 * Extracts all magic numbers from algorithms.
 */

import type { MapConfig, LayoutConfig, ClusteringConfig } from '../types/semanticMap.ts';

export const SEMANTIC_MAP_CONFIG: MapConfig = {
  layoutIterations: 100,
  clusteringIterations: 20,
  neighborRadius: 0.3,
  similarityThreshold: 0.5,
} as const;

export const LAYOUT_CONFIG: LayoutConfig = {
  repulsion: 0.5,
  attraction: 0.01,
  damping: 0.8,
  normalizationFactor: 0.8,
} as const;

export const CLUSTERING_CONFIG: ClusteringConfig = {
  minClusters: 3,
  maxIterations: 20,
  convergenceThreshold: 0.001,
} as const;

export const RENDER_CONFIG = {
  svgNamespace: 'http://www.w3.org/2000/svg',
  connectionOpacity: 0.2,
  connectionColor: 'rgba(100, 200, 255, 0.2)',
  nodeColor: '#4fc3f7',
  nodeStroke: '#fff',
  nodeRadius: 8,
  labelColor: '#fff',
  labelFontSize: 12,
  labelOffset: 0.05,
  labelMaxLength: 15,
} as const;
