import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { Channel } from '@isc/core';

interface DiscoverScreenProps {
  onQuery: (query: string) => Promise<PeerMatch[]>;
}

export interface PeerMatch {
  peerId: string;
  channel: Channel;
  score: number;
  online: boolean;
}

export function DiscoverScreen({ onQuery }: DiscoverScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PeerMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const matches = await onQuery(query);
      setResults(matches);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 0.85) return 'Very Close';
    if (score >= 0.7) return 'Nearby';
    if (score >= 0.55) return 'Orbiting';
    return 'Distant';
  };

  const getScoreClass = (score: number): string => {
    if (score >= 0.85) return 'score-high';
    if (score >= 0.7) return 'score-medium';
    if (score >= 0.55) return 'score-low';
    return 'score-distant';
  };

  return (
    <div class="screen discover-screen">
      <header class="screen-header">
        <h1>Discover</h1>
      </header>

      <div class="search-box">
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search for peers..."
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? '...' : '🔍'}
        </button>
      </div>

      <div class="results-list">
        {results.length === 0 && !loading && (
          <p class="empty-message">Find peers with similar interests</p>
        )}

        {results.map((match) => (
          <div key={match.peerId} class="result-item">
            <div class="result-info">
              <span class="result-name">{match.channel.name}</span>
              <span class="result-desc">{match.channel.description}</span>
              <div class="result-meta">
                {match.channel.relations.slice(0, 2).map((r) => (
                  <span key={r.tag} class="relation-chip">
                    {r.tag}
                  </span>
                ))}
              </div>
            </div>
            <div class="result-score">
              <span class={`score-badge ${getScoreClass(match.score)}`}>
                {Math.round(match.score * 100)}%
              </span>
              <span class="score-label">{getScoreLabel(match.score)}</span>
              <span class={`online-indicator ${match.online ? 'online' : 'offline'}`}>
                {match.online ? '● Online' : '○ Offline'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
