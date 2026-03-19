/**
 * Peer Filtering Hook
 */

import { useMemo } from 'preact/hooks';
import { MatchService } from '../services/MatchService.js';
import type { Match, ProximityLevel } from '../types/discover.js';

export interface FilterOptions {
  minSimilarity?: number;
  proximityLevel?: ProximityLevel | 'ALL';
  searchQuery?: string;
}

export function usePeerFiltering(
  matches: Match[],
  options: FilterOptions = {}
) {
  const matchService = new MatchService();

  const filteredMatches = useMemo(() => {
    let result = [...matches];

    // Filter by minimum similarity
    if (options.minSimilarity) {
      result = result.filter((m) => m.similarity >= options.minSimilarity!);
    }

    // Filter by proximity level
    if (options.proximityLevel && options.proximityLevel !== 'ALL') {
      const threshold = getThresholdForLevel(options.proximityLevel);
      const nextThreshold = getNextThresholdForLevel(options.proximityLevel);
      
      result = result.filter((m) => {
        if (nextThreshold) {
          return m.similarity >= threshold && m.similarity < nextThreshold;
        }
        return m.similarity >= threshold;
      });
    }

    // Filter by search query
    if (options.searchQuery) {
      const query = options.searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.description?.toLowerCase().includes(query) ||
          m.relTag?.toLowerCase().includes(query) ||
          m.peerId.toLowerCase().includes(query)
      );
    }

    return result;
  }, [matches, options.minSimilarity, options.proximityLevel, options.searchQuery]);

  const groupedMatches = useMemo(() => {
    return matchService.groupByProximity(matches);
  }, [matches]);

  return {
    filteredMatches,
    groupedMatches,
    totalCount: matches.length,
    filteredCount: filteredMatches.length,
  };
}

function getThresholdForLevel(level: ProximityLevel): number {
  switch (level) {
    case 'VERY_CLOSE':
      return 0.85;
    case 'NEARBY':
      return 0.70;
    case 'ORBITING':
      return 0.55;
    default:
      return 0;
  }
}

function getNextThresholdForLevel(level: ProximityLevel): number | undefined {
  switch (level) {
    case 'VERY_CLOSE':
      return undefined;
    case 'NEARBY':
      return 0.85;
    case 'ORBITING':
      return 0.70;
    default:
      return undefined;
  }
}
