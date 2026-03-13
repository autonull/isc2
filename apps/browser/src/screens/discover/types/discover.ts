/**
 * Discover Type Definitions
 */

export interface Match {
  peerId: string;
  similarity: number;
  channelID: string;
  description?: string;
  model: string;
  vec?: number[];
  relTag?: string;
  updatedAt: number;
}

export interface QueryCacheEntry {
  matches: Match[];
  timestamp: number;
}

export interface PeerInfo {
  peerId: string;
  channelID: string;
  model: string;
  vec: number[];
  relTag?: string;
  updatedAt: number;
}

export type ProximityLevel = 'VERY_CLOSE' | 'NEARBY' | 'ORBITING' | 'DISTANT';

export interface MatchGroup {
  level: ProximityLevel;
  matches: Match[];
  threshold: number;
}
