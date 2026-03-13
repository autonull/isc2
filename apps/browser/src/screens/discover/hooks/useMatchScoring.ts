/**
 * Match Scoring Hook
 */

import { useMemo } from 'preact/hooks';
import { MatchService } from '../services/MatchService.js';
import type { Match } from '../types/discover.js';

export function useMatchScoring(matches: Match[]) {
  const matchService = new MatchService();

  const scoredMatches = useMemo(() => {
    return matches.map((match) => ({
      ...match,
      signalBars: matchService.formatSignalBars(match.similarity),
      proximityLabel: matchService.getProximityLabel(match.similarity),
      timeAgo: formatTimeAgo(match.updatedAt),
    }));
  }, [matches]);

  const averageSimilarity = useMemo(() => {
    if (matches.length === 0) return 0;
    const sum = matches.reduce((acc, m) => acc + m.similarity, 0);
    return sum / matches.length;
  }, [matches]);

  const bestMatch = useMemo(() => {
    if (matches.length === 0) return null;
    return matches.reduce((best, current) =>
      current.similarity > best.similarity ? current : best
    );
  }, [matches]);

  return {
    scoredMatches,
    averageSimilarity,
    bestMatch,
    totalCount: matches.length,
  };
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
