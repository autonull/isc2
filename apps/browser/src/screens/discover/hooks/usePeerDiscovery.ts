/**
 * Peer Discovery Hook
 *
 * Discovers and ranks peers based on semantic similarity using real embeddings.
 */

import { useState, useCallback, useEffect } from 'preact/hooks';
import { channelManager } from '../../../channels/manager.js';
import { PeerDiscoveryService } from '../services/PeerDiscoveryService.js';
import { MatchService } from '../services/MatchService.js';
import { DISCOVER_CONFIG } from '../config/discoverConfig.js';
import type { Match } from '../types/discover.js';
import type { Channel } from '@isc/core';
import { notificationService } from '../../../chat/notifications.js';

const queryCache = new Map<string, { matches: Match[]; timestamp: number }>();

export function usePeerDiscovery() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  const discoveryService = new PeerDiscoveryService();
  const matchService = new MatchService();

  const computeChannelVector = useCallback(
    async (channel: Channel): Promise<number[]> => {
      try {
        // Lazy import embedding functions to avoid module-level initialization
        const { computeEmbedding, isModelLoaded } = await import('../../../identity/embedding-service.js');
        // computeEmbedding falls back to word-hash if model not loaded
        const embedding = await computeEmbedding(channel.description);
        setModelStatus(isModelLoaded() ? 'ready' : 'fallback');
        return embedding;
      } catch (err) {
        console.warn('Embedding not available, using fallback', err);
        setModelStatus('fallback');
        // Fallback: simple hash-based embedding
        return computeFallbackEmbedding(channel.description);
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

      // Notify if new matches found
      const prevMatches = queryCache.get(cacheKey)?.matches || [];
      if (deduplicatedMatches.length > prevMatches.length && document.visibilityState === 'hidden') {
        const topSimilarity = deduplicatedMatches[0]?.similarity || 0;
        const newCount = deduplicatedMatches.length - prevMatches.length;
        notificationService.showMatchNotification(newCount, topSimilarity);
      }

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
    modelStatus,
    loadMatches,
    refreshMatches,
  };
}

/**
 * Fallback embedding using simple word hashing
 */
function computeFallbackEmbedding(text: string): number[] {
  const words = text.toLowerCase().match(/\w+/g) || [];
  const embedding = new Array(384).fill(0);
  
  for (let i = 0; i < words.length && i < 384; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(j);
      hash = hash & hash;
    }
    embedding[i % 384] += Math.abs(hash) / 1000000;
  }
  
  // Normalize
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < 384; i++) {
      embedding[i] /= norm;
    }
  }
  
  return embedding;
}
