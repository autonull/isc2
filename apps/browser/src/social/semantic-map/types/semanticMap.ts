/**
 * Semantic Map Type Definitions
 */

export interface Point2D {
  x: number;
  y: number;
  data: unknown;
}

export interface SemanticNode {
  id: string;
  embedding: number[];
  position: Point2D;
  metadata?: Record<string, unknown>;
}

export interface Cluster {
  id: string;
  centroid: Point2D;
  nodes: string[];
}

export interface MapConfig {
  layoutIterations: number;
  clusteringIterations: number;
  neighborRadius: number;
  similarityThreshold: number;
}

export interface LayoutConfig {
  repulsion: number;
  attraction: number;
  damping: number;
  normalizationFactor: number;
}

export interface ClusteringConfig {
  minClusters: number;
  maxIterations: number;
  convergenceThreshold: number;
}
