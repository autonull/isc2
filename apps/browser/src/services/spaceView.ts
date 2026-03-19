/**
 * Space View Service
 *
 * 2D semantic map projection using UMAP-like algorithm.
 * Shows peers in "thought space" - closer = more semantically similar.
 *
 * Features:
 * - Dimensionality reduction (384D → 2D)
 * - Real-time peer position updates
 * - Cluster detection and highlighting
 * - Smooth animations for position changes
 */

import type { PeerMatch } from '../services/network.js';

export interface Position2D {
  x: number;
  y: number;
}

export interface ProjectedPeer extends PeerMatch {
  position: Position2D;
  velocity?: Position2D;
  clusterId?: number;
  isSelf: boolean;
}

export interface SpaceViewState {
  peers: ProjectedPeer[];
  clusters: Cluster[];
  viewTransform: ViewTransform;
  focusedPeerId?: string;
}

export interface Cluster {
  id: number;
  center: Position2D;
  radius: number;
  peerCount: number;
  dominantTopics: string[];
  color: string;
}

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface SpaceViewConfig {
  enabled: boolean;
  projectionQuality: 'fast' | 'balanced' | 'high';
  animationEnabled: boolean;
  clusterDetection: boolean;
  showGhostPeers: boolean;
  selfPosition: Position2D;
}

const DEFAULT_CONFIG: SpaceViewConfig = {
  enabled: true,
  projectionQuality: 'balanced',
  animationEnabled: true,
  clusterDetection: true,
  showGhostPeers: true,
  selfPosition: { x: 0, y: 0 },
};

// Color palette for clusters
const CLUSTER_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export class SpaceViewService {
  private config: SpaceViewConfig;
  private peerEmbeddings = new Map<string, number[]>();
  private peerPositions = new Map<string, Position2D>();
  private previousPositions = new Map<string, Position2D>();
  private clusters: Cluster[] = [];
  private listeners: Set<(state: SpaceViewState) => void> = new Set();
  private animationFrame: number | null = null;
  private lastUpdateTime = 0;

  constructor(config: Partial<SpaceViewConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize space view
   */
  start(): void {
    console.log('[SpaceView] Starting with config:', this.config);
    this.startAnimationLoop();
  }

  /**
   * Stop space view
   */
  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Update peers and recalculate positions
   */
  updatePeers(peers: PeerMatch[], selfEmbedding?: number[]): void {
    const now = Date.now();
    
    // Store self embedding
    if (selfEmbedding) {
      this.peerEmbeddings.set('self', selfEmbedding);
    }

    // Store peer embeddings
    peers.forEach(peer => {
      if ((peer as any)._embedding) {
        this.peerEmbeddings.set(peer.peerId, (peer as any)._embedding);
      }
    });

    // Project to 2D
    this.projectTo2D(peers);

    // Detect clusters
    if (this.config.clusterDetection) {
      this.detectClusters(peers);
    }

    // Emit update
    this.emitUpdate(peers);

    this.lastUpdateTime = now;
  }

  /**
   * Get current state
   */
  getState(): SpaceViewState {
    return {
      peers: this.getProjectedPeers(),
      clusters: [...this.clusters],
      viewTransform: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
    };
  }

  /**
   * Subscribe to state updates
   */
  onUpdate(callback: (state: SpaceViewState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Focus on a specific peer
   */
  focusPeer(peerId: string): void {
    const state = this.getState();
    const peer = state.peers.find(p => p.peerId === peerId);
    
    if (peer) {
      // Center view on peer
      state.viewTransform.offsetX = -peer.position.x;
      state.viewTransform.offsetY = -peer.position.y;
      
      this.emitUpdate(state.peers);
    }
  }

  /**
   * Reset view to show all peers
   */
  resetView(): void {
    this.emitUpdate(this.getProjectedPeers());
  }

  /**
   * Project high-dimensional embeddings to 2D
   * Uses a simplified MDS-like approach for performance
   */
  private projectTo2D(peers: PeerMatch[]): void {
    const allPeers: Array<{ id: string; embedding: number[] }> = [];
    
    // Add self
    const selfEmbedding = this.peerEmbeddings.get('self');
    if (selfEmbedding) {
      allPeers.push({ id: 'self', embedding: selfEmbedding });
    }

    // Add peers with embeddings
    peers.forEach(peer => {
      const embedding = this.peerEmbeddings.get(peer.peerId);
      if (embedding) {
        allPeers.push({ id: peer.peerId, embedding });
      }
    });

    if (allPeers.length < 2) return;

    // Use PCA-like projection for speed
    // In production, would use proper UMAP/t-SNE
    const positions = this.fastProject(allPeers);

    // Store positions
    positions.forEach((pos, id) => {
      this.previousPositions.set(id, this.peerPositions.get(id));
      this.peerPositions.set(id, pos);
    });
  }

  /**
   * Fast projection using pairwise distances
   */
  private fastProject(
    peers: Array<{ id: string; embedding: number[] }>
  ): Map<string, Position2D> {
    const n = peers.length;
    const positions = new Map<string, Position2D>();

    if (n === 0) return positions;

    // Calculate pairwise distances
    const distances: number[][] = [];
    for (let i = 0; i < n; i++) {
      distances[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distances[i][j] = 0;
        } else {
          distances[i][j] = this.cosineDistance(
            peers[i].embedding,
            peers[j].embedding
          );
        }
      }
    }

    // Simple MDS-like projection
    // Place first point at origin
    positions.set(peers[0].id, { x: 0, y: 0 });

    if (n === 1) return positions;

    // Place second point on x-axis
    const d01 = distances[0][1];
    positions.set(peers[1].id, { x: d01 * 10, y: 0 });

    if (n === 2) return positions;

    // Place remaining points using trilateration
    for (let i = 2; i < n; i++) {
      const pos = this.trilaterate(i, peers, distances, positions);
      positions.set(peers[i].id, pos);
    }

    // Center all positions
    this.centerPositions(positions);

    return positions;
  }

  /**
   * Trilaterate position based on distances to existing points
   */
  private trilaterate(
    newIndex: number,
    peers: Array<{ id: string; embedding: number[] }>,
    distances: number[][],
    existingPositions: Map<string, Position2D>
  ): Position2D {
    // Use first two placed points for trilateration
    const existingIds = Array.from(existingPositions.keys());
    
    if (existingIds.length < 2) {
      return { x: Math.random() * 100 - 50, y: Math.random() * 100 - 50 };
    }

    const id1 = existingIds[0];
    const id2 = existingIds[1];
    
    const idx1 = peers.findIndex(p => p.id === id1);
    const idx2 = peers.findIndex(p => p.id === id2);
    const idxNew = newIndex;

    const pos1 = existingPositions.get(id1)!;
    const pos2 = existingPositions.get(id2)!;

    const d1 = distances[idxNew][idx1] * 10;
    const d2 = distances[idxNew][idx2] * 10;
    const d12 = Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2)
    );

    if (d12 === 0) {
      return { x: pos1.x + d1, y: pos1.y };
    }

    // Trilateration formula
    const a = (d1 * d1 - d2 * d2 + d12 * d12) / (2 * d12);
    const h = Math.sqrt(Math.max(0, d1 * d1 - a * a));

    const x2 = pos1.x + (a * (pos2.x - pos1.x)) / d12;
    const y2 = pos1.y + (a * (pos2.y - pos1.y)) / d12;

    // Two possible solutions, pick one based on index for consistency
    const sign = newIndex % 2 === 0 ? 1 : -1;
    const x3 = x2 + (sign * h * (pos2.y - pos1.y)) / d12;
    const y3 = y2 - (sign * h * (pos2.x - pos1.x)) / d12;

    return { x: x3, y: y3 };
  }

  /**
   * Center positions around origin
   */
  private centerPositions(positions: Map<string, Position2D>): void {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    positions.forEach(pos => {
      sumX += pos.x;
      sumY += pos.y;
      count++;
    });

    if (count === 0) return;

    const centerX = sumX / count;
    const centerY = sumY / count;

    positions.forEach((pos, id) => {
      positions.set(id, {
        x: pos.x - centerX,
        y: pos.y - centerY,
      });
    });
  }

  /**
   * Detect clusters in peer positions
   */
  private detectClusters(peers: PeerMatch[]): void {
    const positions = Array.from(this.peerPositions.entries());
    
    if (positions.length < 3) {
      this.clusters = [];
      return;
    }

    // Simple k-means clustering
    const k = Math.min(4, Math.ceil(positions.length / 3));
    const clusters = this.kMeans(positions, k);

    // Convert to Cluster objects
    this.clusters = clusters.map((cluster, idx) => {
      const clusterPeers = peers.filter(p => 
        cluster.peerIds.includes(p.peerId)
      );
      
      const topics = clusterPeers.flatMap(p => p.matchedTopics || []);
      const topicCounts = new Map<string, number>();
      topics.forEach(t => topicCounts.set(t, (topicCounts.get(t) || 0) + 1));
      
      const dominantTopics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(t => t[0]);

      return {
        id: idx,
        center: cluster.center,
        radius: cluster.radius,
        peerCount: cluster.peerIds.length,
        dominantTopics,
        color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
      };
    });
  }

  /**
   * Simple k-means clustering
   */
  private kMeans(
    positions: Array<[string, Position2D]>,
    k: number
  ): Array<{ center: Position2D; radius: number; peerIds: string[] }> {
    if (positions.length === 0) return [];

    // Initialize centroids randomly
    let centroids = this.shuffleArray([...positions])
      .slice(0, k)
      .map(([, pos]) => ({ ...pos }));

    let assignments = new Map<string, number>();
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 50) {
      changed = false;
      iterations++;

      // Assign points to nearest centroid
      const newAssignments = new Map<string, number>();
      positions.forEach(([id, pos]) => {
        let minDist = Infinity;
        let minIdx = 0;
        centroids.forEach((centroid, idx) => {
          const dist = this.distance2D(pos, centroid);
          if (dist < minDist) {
            minDist = dist;
            minIdx = idx;
          }
        });
        newAssignments.set(id, minIdx);
        if (assignments.get(id) !== minIdx) {
          changed = true;
        }
      });
      assignments = newAssignments;

      // Update centroids
      for (let i = 0; i < k; i++) {
        const clusterPoints = positions
          .filter(([, id]) => assignments.get(id[0]) === i)
          .map(([, pos]) => pos);

        if (clusterPoints.length > 0) {
          centroids[i] = {
            x: clusterPoints.reduce((s, p) => s + p.x, 0) / clusterPoints.length,
            y: clusterPoints.reduce((s, p) => s + p.y, 0) / clusterPoints.length,
          };
        }
      }
    }

    // Build result
    const result: Array<{ center: Position2D; radius: number; peerIds: string[] }> = [];
    for (let i = 0; i < k; i++) {
      const clusterPoints = positions.filter(
        ([, id]) => assignments.get(id[0]) === i
      );
      
      if (clusterPoints.length === 0) continue;

      const center = centroids[i];
      const radius = Math.max(
        ...clusterPoints.map(([, pos]) => this.distance2D(pos, center))
      );

      result.push({
        center,
        radius,
        peerIds: clusterPoints.map(([id]) => id),
      });
    }

    return result;
  }

  /**
   * Get projected peers with positions
   */
  private getProjectedPeers(): ProjectedPeer[] {
    const result: ProjectedPeer[] = [];

    this.peerPositions.forEach((position, peerId) => {
      const isSelf = peerId === 'self';
      
      // Find original peer data
      // In real implementation, would merge with peer match data
      
      result.push({
        peerId,
        identity: { name: isSelf ? 'You' : peerId.slice(0, 8), bio: '' },
        similarity: 0,
        matchedTopics: [],
        online: true,
        position,
        isSelf,
      });
    });

    return result;
  }

  /**
   * Animation loop for smooth transitions
   */
  private startAnimationLoop(): void {
    const animate = () => {
      if (this.config.animationEnabled) {
        this.animatePositions();
      }
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Animate position transitions
   */
  private animatePositions(): void {
    // In full implementation, would interpolate between previous and current positions
    // For now, positions update instantly
  }

  private emitUpdate(peers: PeerMatch[]): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  private cosineDistance(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 1;
    
    return 1 - (dot / (Math.sqrt(normA) * Math.sqrt(normB)));
  }

  private distance2D(a: Position2D, b: Position2D): number {
    return Math.sqrt(
      Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2)
    );
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<SpaceViewConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('[SpaceView] Config updated:', this.config);
  }
}

// Singleton instance
let _instance: SpaceViewService | null = null;

export function getSpaceViewService(config?: Partial<SpaceViewConfig>): SpaceViewService {
  if (!_instance) {
    _instance = new SpaceViewService(config);
  }
  return _instance;
}
