/**
 * Peer Discovery Hook
 */

import { useState, useCallback } from 'preact/hooks';
import { channelManager } from '../../../channels/manager.js';
import { embeddingService } from '../../../channels/embedding.js';
import { PeerDiscoveryService } from '../services/PeerDiscoveryService.js';
import { MatchService } from '../services/MatchService.js';
import { DISCOVER_CONFIG } from '../config/discoverConfig.js';
import type { Match } from '../types/discover.js';
import type { Channel } from '@isc/core';

const queryCache = new Map<string, { matches: Match[]; timestamp: number }>();

export function usePeerDiscovery() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const discoveryService = new PeerDiscoveryService();
  const matchService = new MatchService();

  const computeChannelVector = useCallback(
    async (channel: Channel): Promise<number[]> => {
      try {
        return await embeddingService.embed(channel.description);
      } catch {
        // Fallback to stub embedding
        const encoder = new TextEncoder();
        const hash = await crypto.subtle.digest(
          'SHA-256',
          encoder.encode(channel.description)
        );
        const hashBytes = new Uint8Array(hash);
        const vec = Array.from({ length: 384 }, (_, i) => {
          const byte = hashBytes[i % 32];
          return (byte / 255) * 2 - 1;
        });
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
        return vec.map((v) => v / norm);
      }
    },
    []
  );

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const channels = await channelManager.getAllChannels();
      const active = channels.find((c) => c.active) || channels[0] || null;
      setActiveChannel(active);

      if (!active) {
        setMatches([]);
        setLoading(false);
        return;
      }

      // Check cache
      const cacheKey = active.id;
      const cached = queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < DISCOVER_CONFIG.queryCacheTTL) {
        setMatches(cached.matches);
        setLoading(false);
        return;
      }

      // Check DHT connection
      if (!discoveryService.isConnected()) {
        setError('Not connected to DHT network');
        setLoading(false);
        return;
      }

      const queryVec = await computeChannelVector(active);
      const modelHash = DISCOVER_CONFIG.localModel.replace(/[^a-zA-Z0-9]/g, '').slice(0, DISCOVER_CONFIG.modelHashLength);

      const peers = await discoveryService.discoverPeers(queryVec, modelHash);
      const ownPeerId = discoveryService.getOwnPeerId();

      const filteredPeers = peers.filter(
        (peer) => !matchService.shouldFilterMatch(peer, ownPeerId)
      );

      const rankedMatches = matchService.rankMatches(filteredPeers, queryVec);
      const deduplicatedMatches = matchService.deduplicateMatches(rankedMatches);

      // Cache results
      queryCache.set(cacheKey, {
        matches: deduplicatedMatches,
        timestamp: Date.now(),
      });

      setMatches(deduplicatedMatches);
    } catch (err) {
      setError('Failed to load matches: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [computeChannelVector]);

  const refreshMatches = useCallback(() => {
    queryCache.clear();
    loadMatches();
  }, [loadMatches]);

  return {
    matches,
    loading,
    error,
    activeChannel,
    loadMatches,
    refreshMatches,
  };
}
