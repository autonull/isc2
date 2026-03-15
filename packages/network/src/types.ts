/**
 * ISC Network - Core Types
 * 
 * Shared types for network communication, DHT, and peer discovery.
 */



/**
 * Peer information stored in DHT
 */
export interface PeerInfo {
  id: string;
  name: string;
  description: string;
  vector: number[];
  topics: string[];
  lastSeen: number;
}

/**
 * Match result from peer discovery
 */
export interface PeerMatch {
  peer: PeerInfo;
  similarity: number;
  matchedTopics: string[];
}

/**
 * DHT interface for peer announcements
 */
export interface DHT {
  announce(peer: PeerInfo, ttl: number): Promise<void>;
  discover(myVector: number[], threshold: number): Promise<PeerMatch[]>;
  getAll(): PeerInfo[];
  getCount(): number;
  cleanup(currentTime: number): number;
}

/**
 * Embedding service interface
 */
export interface EmbeddingService {
  isLoaded(): boolean;
  isLoading(): boolean;
  load(): Promise<void>;
  compute(text: string): Promise<number[]>;
  computeBatch(texts: string[]): Promise<number[][]>;
  similarity(a: number[], b: number[]): number;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  modelId: string;
  similarityThreshold: number;
  announceTTL: number;
  maxPeers: number;
  cleanupInterval: number;
}

/**
 * Default network configuration
 */
export const DEFAULT_CONFIG: NetworkConfig = {
  modelId: 'Xenova/all-MiniLM-L6-v2',
  similarityThreshold: 0.5,
  announceTTL: 300000, // 5 minutes
  maxPeers: 100,
  cleanupInterval: 60000, // 1 minute
};

/**
 * Network events
 */
export interface NetworkEvents {
  onPeerDiscovered: (match: PeerMatch) => void;
  onPeerAnnounced: (peer: PeerInfo) => void;
  onPeerExpired: (peerId: string) => void;
  onError: (error: Error) => void;
}

/**
 * Network statistics
 */
export interface NetworkStats {
  peerCount: number;
  totalAnnounces: number;
  totalDiscoveries: number;
  totalMatches: number;
  avgSimilarity: number;
  uptime: number;
}
