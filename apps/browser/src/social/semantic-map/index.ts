/**
 * Semantic Map Module
 *
 * 2D projection and interactive visualization of embedding space.
 */

export { SemanticMapService } from './services/SemanticMapService.js';
export {
  computeChannelPositions,
  findNeighbors,
  projectTo2D,
} from './services/SemanticLayoutService.js';
export { kmeansClusters, hierarchicalClusters } from './algorithms/clustering.js';
export { forceDirectedLayout, initializeOnUnitCircle } from './algorithms/layout.js';
export { computeSimilarity, findSimilar, rankBySimilarity } from './algorithms/similarity.js';
export { renderToSVG, renderToCanvas, clearContainer } from './renderer/SemanticMapRenderer.js';

export {
  SEMANTIC_MAP_CONFIG,
  LAYOUT_CONFIG,
  CLUSTERING_CONFIG,
  RENDER_CONFIG,
} from './config/semanticConfig.js';

export type {
  Point2D,
  SemanticNode,
  Cluster,
  MapConfig,
  LayoutConfig,
  ClusteringConfig,
} from './types/semanticMap.js';
