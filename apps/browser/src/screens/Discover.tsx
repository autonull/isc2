/**
 * Discover Screen - Find Nearby Peers
 */

import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { channelManager } from '../channels/manager.js';
import type { Channel } from '@isc/core';

interface Match {
  peerID: string;
  similarity: number;
  channelID: string;
  description?: string;
  relTag?: string;
  updatedAt: number;
}

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, height: '100%' },
  header: { padding: '16px', borderBottom: '1px solid #e1e8ed' } as const,
  title: { fontSize: '18px', fontWeight: 'bold' as const, margin: '0 0 8px 0' },
  subtitle: { fontSize: '14px', color: '#657786' } as const,
  content: { flex: 1, padding: '16px', overflowY: 'auto' as const },
  section: { marginBottom: '24px' } as const,
  sectionTitle: { fontSize: '14px', fontWeight: 'bold' as const, color: '#657786', marginBottom: '12px', textTransform: 'uppercase' as const } as const,
  matchCard: { background: 'white', border: '1px solid #e1e8ed', borderRadius: '8px', padding: '16px', marginBottom: '12px', cursor: 'pointer' } as const,
  matchHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } as const,
  similarity: { fontSize: '14px', fontWeight: 'bold' as const } as const,
  signalBars: { fontSize: '16px', letterSpacing: '2px' } as const,
  description: { fontSize: '14px', color: '#14171a', marginBottom: '8px', lineHeight: 1.4 } as const,
  meta: { fontSize: '12px', color: '#657786', display: 'flex', gap: '12px' } as const,
  actionBtn: { padding: '8px 16px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' as const } as const,
  empty: { textAlign: 'center' as const, padding: '48px 16px', color: '#657786' } as const,
  emptyIcon: { fontSize: '48px', marginBottom: '16px' } as const,
  refreshBtn: { display: 'block', margin: '16px auto', padding: '8px 24px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } as const,
  loading: { textAlign: 'center' as const, padding: '48px 16px' } as const,
  spinner: { width: '32px', height: '32px', border: '3px solid #e1e8ed', borderTopColor: '#1da1f2', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' } as const,
};

function formatSimilarity(similarity: number): string {
  if (similarity >= 0.85) return '▐▌▐▌▐';
  if (similarity >= 0.70) return '▐▌▐▌░';
  if (similarity >= 0.55) return '▐▌░░░';
  return '░░░░░';
}

function getProximityLabel(similarity: number): string {
  if (similarity >= 0.85) return 'VERY CLOSE';
  if (similarity >= 0.70) return 'NEARBY';
  if (similarity >= 0.55) return 'ORBITING';
  return 'DISTANT';
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DiscoverScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get active channel
      const channels = await channelManager.getAllChannels();
      const active = channels.find(c => c.active) || channels[0] || null;
      setActiveChannel(active);

      if (!active) {
        setMatches([]);
        return;
      }

      // In production, this would query the DHT
      // For now, generate mock matches based on channel description
      const mockMatches = generateMockMatches(active);
      setMatches(mockMatches);
    } catch (err) {
      setError('Failed to load matches: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleRefresh = () => {
    loadMatches();
  };

  const handleDial = (match: Match) => {
    // In production, this would initiate a WebRTC connection
    alert(`Would dial peer ${match.peerID.slice(0, 8)}...\nSimilarity: ${(match.similarity * 100).toFixed(1)}%`);
  };

  if (loading) {
    return (
      <div style={styles.screen}>
        <header style={styles.header}>
          <h1 style={styles.title}>Discover</h1>
          <p style={styles.subtitle}>Finding nearby peers...</p>
        </header>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '16px' }}>Searching the network...</p>
        </div>
      </div>
    );
  }

  // Group matches by proximity
  const veryClose = matches.filter(m => m.similarity >= 0.85);
  const nearby = matches.filter(m => m.similarity >= 0.70 && m.similarity < 0.85);
  const orbiting = matches.filter(m => m.similarity >= 0.55 && m.similarity < 0.70);

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <h1 style={styles.title}>Discover</h1>
        <p style={styles.subtitle}>
          {activeChannel ? `Querying: ${activeChannel.name}` : 'No active channel'}
        </p>
      </header>

      <div style={styles.content}>
        {error && (
          <div style={{ ...styles.empty, color: '#ff4444' }}>
            <p>{error}</p>
            <button style={styles.refreshBtn} onClick={handleRefresh}>Try Again</button>
          </div>
        )}

        {!error && matches.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🔍</div>
            <p>No matches found</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              {activeChannel
                ? 'Try editing your channel description or wait for more peers to announce'
                : 'Create a channel to start discovering peers'}
            </p>
            <button style={styles.refreshBtn} onClick={handleRefresh}>Refresh</button>
          </div>
        )}

        {veryClose.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Very Close ({veryClose.length})</h2>
            {veryClose.map(match => (
              <MatchCard key={match.peerID} match={match} onDial={handleDial} />
            ))}
          </div>
        )}

        {nearby.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Nearby ({nearby.length})</h2>
            {nearby.map(match => (
              <MatchCard key={match.peerID} match={match} onDial={handleDial} />
            ))}
          </div>
        )}

        {orbiting.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Orbiting ({orbiting.length})</h2>
            {orbiting.map(match => (
              <MatchCard key={match.peerID} match={match} onDial={handleDial} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match, onDial }: { match: Match; onDial: (m: Match) => void }) {
  return (
    <div style={styles.matchCard}>
      <div style={styles.matchHeader}>
        <span style={styles.similarity}>
          {formatSimilarity(match.similarity)} {(match.similarity * 100).toFixed(0)}%
        </span>
        <span style={styles.meta}>{timeAgo(match.updatedAt)}</span>
      </div>
      {match.description && (
        <p style={styles.description}>{match.description}</p>
      )}
      <div style={styles.meta}>
        <span>Peer {match.peerID.slice(0, 8)}...</span>
        {match.relTag && <span>• {match.relTag}</span>}
      </div>
      <button
        style={{ ...styles.actionBtn, marginTop: '12px' }}
        onClick={() => onDial(match)}
      >
        Start Chat
      </button>
    </div>
  );
}

// Mock match generator for demo purposes
function generateMockMatches(channel: Channel): Match[] {
  const rng = seededRng(channel.id + Date.now());
  const numMatches = Math.floor(rng() * 8); // 0-7 matches
  
  const descriptions = [
    'Also thinking about ' + channel.description.toLowerCase().split(' ')[0],
    'Related perspective on this topic',
    'Interesting take on ' + channel.name.toLowerCase(),
    'Similar questions about this',
    'Exploring related concepts',
  ];

  const matches: Match[] = [];
  for (let i = 0; i < numMatches; i++) {
    const similarity = 0.55 + rng() * 0.4; // 0.55-0.95
    matches.push({
      peerID: `peer_${Math.random().toString(36).slice(2, 10)}`,
      similarity,
      channelID: channel.id,
      description: descriptions[Math.floor(rng() * descriptions.length)],
      relTag: rng() > 0.7 ? 'under_domain' : undefined,
      updatedAt: Date.now() - Math.floor(rng() * 3600000), // Within last hour
    });
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

function seededRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  let state = Math.abs(hash);
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}
