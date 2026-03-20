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

const CLUSTER_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

export class SpaceViewService {
  private config: SpaceViewConfig;
  private peerEmbeddings = new Map<string, number[]>();
  private peerPositions = new Map<string, Position2D>();
  private previousPositions = new Map<string, Position2D>();
  private clusters: Cluster[] = [];
  private listeners = new Set<(state: SpaceViewState) => void>();
  private animationFrame: number | null = null;

  constructor(config: Partial<SpaceViewConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    console.log('[SpaceView] Starting with config:', this.config);
    this.startAnimationLoop();
  }
  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  updatePeers(peers: PeerMatch[], selfEmbedding?: number[]): void {
    if (selfEmbedding) this.peerEmbeddings.set('self', selfEmbedding);
    peers.forEach((peer) => {
      if ((peer as unknown as Record<string, unknown>)._embedding)
        this.peerEmbeddings.set(
          peer.peerId,
          (peer as unknown as Record<string, unknown>)._embedding as number[]
        );
    });
    this.projectTo2D(peers);
    if (this.config.clusterDetection) this.detectClusters(peers);
    this.emitUpdate(peers);
  }

  getState(): SpaceViewState {
    return {
      peers: this.getProjectedPeers(),
      clusters: [...this.clusters],
      viewTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    };
  }

  onUpdate(callback: (state: SpaceViewState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  focusPeer(peerId: string): void {
    const state = this.getState();
    const peer = state.peers.find((p) => p.peerId === peerId);
    if (peer) {
      state.viewTransform.offsetX = -peer.position.x;
      state.viewTransform.offsetY = -peer.position.y;
      this.emitUpdate(state.peers);
    }
  }

  resetView(): void {
    this.emitUpdate(this.getProjectedPeers());
  }

  private projectTo2D(peers: PeerMatch[]): void {
    const allPeers: Array<{ id: string; embedding: number[] }> = [];
    const selfEmbedding = this.peerEmbeddings.get('self');
    if (selfEmbedding) allPeers.push({ id: 'self', embedding: selfEmbedding });
    peers.forEach((peer) => {
      const embedding = this.peerEmbeddings.get(peer.peerId);
      if (embedding) allPeers.push({ id: peer.peerId, embedding });
    });
    if (allPeers.length < 2) return;
    const positions = this.fastProject(allPeers);
    positions.forEach((pos, id) => {
      this.previousPositions.set(id, this.peerPositions.get(id));
      this.peerPositions.set(id, pos);
    });
  }

  private fastProject(peers: Array<{ id: string; embedding: number[] }>): Map<string, Position2D> {
    const positions = new Map<string, Position2D>();
    const n = peers.length;
    if (n === 0) return positions;

    const distances = peers.map((pI, i) =>
      peers.map((pJ, j) => (i === j ? 0 : this.cosineDistance(pI.embedding, pJ.embedding)))
    );

    positions.set(peers[0].id, { x: 0, y: 0 });
    if (n === 1) return positions;

    positions.set(peers[1].id, { x: distances[0][1] * 10, y: 0 });
    if (n === 2) return positions;

    for (let i = 2; i < n; i++)
      positions.set(peers[i].id, this.trilaterate(i, peers, distances, positions));

    this.centerPositions(positions);
    return positions;
  }

  private trilaterate(
    newIndex: number,
    peers: Array<{ id: string; embedding: number[] }>,
    distances: number[][],
    existingPositions: Map<string, Position2D>
  ): Position2D {
    const existingIds = [...existingPositions.keys()];
    if (existingIds.length < 2) return { x: Math.random() * 100 - 50, y: Math.random() * 100 - 50 };

    const [id1, id2] = existingIds;
    const idx1 = peers.findIndex((p) => p.id === id1);
    const idx2 = peers.findIndex((p) => p.id === id2);
    const pos1 = existingPositions.get(id1)!;
    const pos2 = existingPositions.get(id2)!;
    const d1 = distances[newIndex][idx1] * 10;
    const d2 = distances[newIndex][idx2] * 10;
    const d12 = Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));

    if (d12 === 0) return { x: pos1.x + d1, y: pos1.y };

    const a = (d1 * d1 - d2 * d2 + d12 * d12) / (2 * d12);
    const h = Math.sqrt(Math.max(0, d1 * d1 - a * a));
    const x2 = pos1.x + (a * (pos2.x - pos1.x)) / d12;
    const y2 = pos1.y + (a * (pos2.y - pos1.y)) / d12;
    const sign = newIndex % 2 === 0 ? 1 : -1;
    return {
      x: x2 + (sign * h * (pos2.y - pos1.y)) / d12,
      y: y2 - (sign * h * (pos2.x - pos1.x)) / d12,
    };
  }

  private centerPositions(positions: Map<string, Position2D>): void {
    const positionsArr = [...positions.entries()];
    if (positionsArr.length === 0) return;
    const centerX = positionsArr.reduce((sum, [, pos]) => sum + pos.x, 0) / positionsArr.length;
    const centerY = positionsArr.reduce((sum, [, pos]) => sum + pos.y, 0) / positionsArr.length;
    positions.forEach((pos, id) => positions.set(id, { x: pos.x - centerX, y: pos.y - centerY }));
  }

  private detectClusters(peers: PeerMatch[]): void {
    const positions = [...this.peerPositions.entries()];
    if (positions.length < 3) {
      this.clusters = [];
      return;
    }

    const k = Math.min(4, Math.ceil(positions.length / 3));
    const clusters = this.kMeans(positions, k);

    this.clusters = clusters.map((cluster, idx) => {
      const clusterPeers = peers.filter((p) => cluster.peerIds.includes(p.peerId));
      const topics = clusterPeers.flatMap((p) => p.matchedTopics ?? []);
      const topicCounts = new Map<string, number>();
      topics.forEach((t) => topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1));
      const dominantTopics = [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((t) => t[0]);
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

  private kMeans(
    positions: Array<[string, Position2D]>,
    k: number
  ): Array<{ center: Position2D; radius: number; peerIds: string[] }> {
    if (positions.length === 0) return [];
    let centroids = this.shuffleArray([...positions])
      .slice(0, k)
      .map(([, pos]) => ({ ...pos }));
    let assignments = new Map<string, number>();
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 50) {
      changed = false;
      iterations++;
      const newAssignments = new Map<string, number>();
      positions.forEach(([id, pos]) => {
        let minDist = Infinity,
          minIdx = 0;
        centroids.forEach((centroid, idx) => {
          const dist = this.distance2D(pos, centroid);
          if (dist < minDist) {
            minDist = dist;
            minIdx = idx;
          }
        });
        newAssignments.set(id, minIdx);
        if (assignments.get(id) !== minIdx) changed = true;
      });
      assignments = newAssignments;

      for (let i = 0; i < k; i++) {
        const clusterPoints = positions
          .filter(([, id]) => assignments.get(id) === i)
          .map(([, pos]) => pos);
        if (clusterPoints.length > 0) {
          centroids[i] = {
            x: clusterPoints.reduce((s, p) => s + p.x, 0) / clusterPoints.length,
            y: clusterPoints.reduce((s, p) => s + p.y, 0) / clusterPoints.length,
          };
        }
      }
    }

    return [...Array(k).keys()]
      .filter((i) => positions.some(([, id]) => assignments.get(id) === i))
      .map((i) => {
        const clusterPoints = positions.filter(([, id]) => assignments.get(id) === i);
        if (clusterPoints.length === 0) return null;
        const center = centroids[i]; if (!center) continue;
        const radius = Math.max(...clusterPoints.map(([, pos]) => this.distance2D(pos, center)));
        return { center, radius, peerIds: clusterPoints.map(([id]) => id) };
      })
      .filter(Boolean) as Array<{ center: Position2D; radius: number; peerIds: string[] }>;
  }

  private getProjectedPeers(): ProjectedPeer[] {
    return [...this.peerPositions.entries()].map(([peerId, position]) => ({
      peerId,
      identity: { name: peerId === 'self' ? 'You' : peerId.slice(0, 8), bio: '' },
      similarity: 0,
      matchedTopics: [],
      online: true,
      position,
      isSelf: peerId === 'self',
    }));
  }

  private startAnimationLoop(): void {
    const animate = () => {
      if (this.config.animationEnabled) this.animatePositions();
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  private animatePositions(): void {
    /* Future: interpolate between previous and current positions */
  }

  private emitUpdate(peers: PeerMatch[]): void {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  private cosineDistance(a: number[], b: number[]): number {
    const { dot, normA, normB } = a.reduce(
      (acc, val, i) => ({
        dot: acc.dot + val * (b[i] ?? 0),
        normA: acc.normA + val * val,
        normB: acc.normB + (b[i] ?? 0) * (b[i] ?? 0),
      }),
      { dot: 0, normA: 0, normB: 0 }
    );
    return normA === 0 || normB === 0 ? 1 : 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private distance2D(a: Position2D, b: Position2D): number {
    return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  configure(updates: Partial<SpaceViewConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

let _instance: SpaceViewService | null = null;

export function getSpaceViewService(config?: Partial<SpaceViewConfig>): SpaceViewService {
  if (!_instance) _instance = new SpaceViewService(config);
  return _instance;
}
