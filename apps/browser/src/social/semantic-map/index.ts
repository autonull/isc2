/* eslint-disable */
/**
 * Semantic Map Module
 *
 * 2D projection and interactive visualization of embedding space.
 */

export { SemanticMapService } from './services/SemanticMapService.ts';
export {
  computeChannelPositions,
  findNeighbors,
  projectTo2D,
} from './services/SemanticLayoutService.ts';
export { kmeansClusters, hierarchicalClusters } from './algorithms/clustering.ts';
export { forceDirectedLayout, initializeOnUnitCircle } from './algorithms/layout.ts';
export { computeSimilarity, findSimilar, rankBySimilarity } from './algorithms/similarity.ts';
export { renderToSVG, renderToCanvas, clearContainer } from './renderer/SemanticMapRenderer.ts';

export {
  SEMANTIC_MAP_CONFIG,
  LAYOUT_CONFIG,
  CLUSTERING_CONFIG,
  RENDER_CONFIG,
} from './config/semanticConfig.ts';

export type {
  Point2D,
  SemanticNode,
  Cluster,
  MapConfig,
  LayoutConfig,
  ClusteringConfig,
} from './types/semanticMap.ts';
