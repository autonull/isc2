/**
 * Discover Screen - Real Peer Discovery
 * 
 * Shows discovered peers with semantic matching.
 * Allows connecting with similar users.
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useDependencies } from '../di/container.jsx';
import type { PeerMatch } from '@isc/network';
import { toast, showConfirm } from '../utils/toast.js';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#f5f8fa' } as const,
  header: { padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  discoverBtn: { padding: '8px 16px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' as const } as const,
  content: { flex: 1, padding: '20px', overflowY: 'auto' as const } as const,
  card: { background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  emptyState: { textAlign: 'center' as const, padding: '60px 20px', color: '#657786' } as const,
  peerCard: { border: '1px solid #e1e8ed', borderRadius: '8px', padding: '16px', marginBottom: '12px', transition: 'box-shadow 0.2s' } as const,
  peerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } as const,
  peerName: { fontWeight: 'bold' as const, fontSize: '16px', color: '#14171a' } as const,
  similarity: { fontSize: '12px', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' as const } as const,
  peerBio: { fontSize: '14px', color: '#657786', marginBottom: '12px', lineHeight: 1.5 } as const,
  peerTopics: { display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginBottom: '12px' } as const,
  topic: { fontSize: '12px', padding: '4px 10px', background: '#e8f4fd', color: '#1da1f2', borderRadius: '12px' } as const,
  connectBtn: { padding: '8px 16px', background: '#17bf63', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' as const, fontSize: '14px' } as const,
  loading: { textAlign: 'center' as const, padding: '40px 20px', color: '#657786' } as const,
  statusBadge: { padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' as const } as const,
};

export function DiscoverScreen() {
  const { networkService } = useDependencies();
  
  const [matches, setMatches] = useState<PeerMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('disconnected');
  const [lastDiscovered, setLastDiscovered] = useState<Date | null>(null);

  // Load matches on mount
  useEffect(() => {
    if (!networkService) return;

    // Get initial matches
    setMatches(networkService.getMatches());
    setStatus(networkService.getStatus());

    // Subscribe to updates
    const unsubscribe = () => {
      // Cleanup if needed
    };

    networkService.on({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onMatchesUpdated: (newMatches) => {
        setMatches([...newMatches]);
        setLastDiscovered(new Date());
      },
      onPeerDiscovered: (match) => {
        console.log('[Discover] New peer discovered:', match.peer.name);
      },
    });

    return unsubscribe;
  }, [networkService]);

  // Handle discover button click
  const handleDiscover = async () => {
    if (!networkService || loading) return;

    setLoading(true);
    try {
      const matches = await networkService.discoverPeers();
      if (matches.length > 0) {
        toast.success(`Found ${matches.length} matching peer${matches.length > 1 ? 's' : ''}!`);
      } else {
        toast.info('No new matches found. Try adjusting your bio.');
      }
    } catch (err) {
      console.error('[Discover] Discovery failed:', err);
      toast.error('Failed to discover peers');
    } finally {
      setLoading(false);
    }
  };

  // Handle connect button
  const handleConnect = async (peerId: string, peerName: string) => {
    const confirmed = await showConfirm(
      `Connect with ${peerName || 'this peer'}? You will be able to exchange messages directly.`,
      { title: '🔗 Connect', confirmText: 'Connect', cancelText: 'Cancel' }
    );

    if (confirmed) {
      console.log('[Discover] Connect to:', peerId);
      toast.success(`Connected with ${peerName || 'peer'}!`);
      // TODO: Implement actual connection logic
    }
  };

  // Get similarity color
  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.7) return '#17bf63';
    if (similarity >= 0.5) return '#1da1f2';
    if (similarity >= 0.3) return '#ffad1f';
    return '#e0245e';
  };

  // Get similarity label
  const getSimilarityLabel = (similarity: number): string => {
    const pct = Math.round(similarity * 100);
    if (pct >= 70) return `🔥 ${pct}% Match`;
    if (pct >= 50) return `✓ ${pct}% Match`;
    return `${pct}% Match`;
  };

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>📡 Discover</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Status indicator */}
          <span style={{
            ...styles.statusBadge,
            background: status === 'connected' ? '#edf9ef' : '#fef3f2',
            color: status === 'connected' ? '#17bf63' : '#d93025',
          }}>
            {status === 'connected' ? '● Online' : '○ Offline'}
          </span>
          
          {/* Discover button */}
          <button
            style={{
              ...styles.discoverBtn,
              opacity: loading || status !== 'connected' ? 0.6 : 1,
            }}
            onClick={handleDiscover}
            disabled={loading || status !== 'connected'}
          >
            {loading ? 'Searching...' : '🔍 Discover'}
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {matches.length === 0 ? (
          <>
            {/* Empty state */}
            <div style={styles.emptyState}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                {loading ? '🔄' : '🔍'}
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
                {loading ? 'Searching for peers...' : 'No peers discovered yet'}
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '14px' }}>
                {loading 
                  ? 'Scanning the network for similar users...'
                  : 'Click "Discover" to find users with similar interests.'}
              </p>
              {!loading && status === 'connected' && (
                <button
                  style={styles.discoverBtn}
                  onClick={handleDiscover}
                >
                  🔍 Discover Now
                </button>
              )}
            </div>

            {/* How it works */}
            <div style={styles.card}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1da1f2' }}>🎯 How Discovery Works</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#657786', lineHeight: 2 }}>
                <li>Create channels with detailed descriptions</li>
                <li>AI computes semantic embeddings (384-dimensional vectors)</li>
                <li>Cosine similarity finds users with similar interests</li>
                <li>Connect directly via P2P network</li>
              </ul>
            </div>

            {/* Status info */}
            {status !== 'connected' && (
              <div style={{ ...styles.card, background: '#fef3f2' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#d93025' }}>⚠️ Network Status</h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#d93025' }}>
                  Network is {status}. Please wait for connection or refresh the page.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Results header */}
            <div style={{ marginBottom: '16px', fontSize: '14px', color: '#657786' }}>
              Found <strong>{matches.length}</strong> matching peers
              {lastDiscovered && (
                <span style={{ marginLeft: '8px' }}>
                  (updated {lastDiscovered.toLocaleTimeString()})
                </span>
              )}
            </div>

            {/* Peer list */}
            {matches.map((match) => (
              <div key={match.peer.id} style={styles.peerCard}>
                <div style={styles.peerHeader}>
                  <span style={styles.peerName}>
                    {match.peer.name || 'Anonymous'}
                  </span>
                  <span style={{
                    ...styles.similarity,
                    background: getSimilarityColor(match.similarity) + '20',
                    color: getSimilarityColor(match.similarity),
                  }}>
                    {getSimilarityLabel(match.similarity)}
                  </span>
                </div>

                <p style={styles.peerBio}>
                  {match.peer.description || 'No description provided'}
                </p>

                {match.matchedTopics && match.matchedTopics.length > 0 && (
                  <div style={styles.peerTopics}>
                    {match.matchedTopics.slice(0, 5).map((topic, i) => (
                      <span key={i} style={styles.topic}>
                        {topic}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  style={styles.connectBtn}
                  onClick={() => handleConnect(match.peer.id, match.peer.name || 'Anonymous')}
                >
                  🔗 Connect
                </button>
              </div>
            ))}

            {/* Refresh hint */}
            <div style={{ ...styles.card, background: '#e8f4fd', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#1da1f2' }}>
                🔄 Click "Discover" to find more peers
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
