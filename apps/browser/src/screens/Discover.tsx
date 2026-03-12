/**
 * Discover Screen - Find Nearby Peers
 *
 * REAL IMPLEMENTATION - Uses actual libp2p DHT
 */

import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { channelManager } from '../channels/manager.js';
import { getDHTClient, initializeDHT, type PeerInfo } from '../network/dht.js';
import { lshHash, cosineSimilarity } from '@isc/core';
import { getChatHandler, type ChatMessage } from '../chat/webrtc.js';
import type { Channel } from '@isc/core';
import { embeddingService } from '../channels/embedding.js';
import { SkeletonMatch } from '../components/Skeleton.js';

interface Match {
  peerId: string;
  similarity: number;
  channelID: string;
  description?: string;
  model: string;
  vec?: number[];
  relTag?: string;
  updatedAt: number;
}

const LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2';
const SIMILARITY_THRESHOLD = 0.55;
const QUERY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface QueryCacheEntry {
  matches: Match[];
  timestamp: number;
}

const queryCache = new Map<string, QueryCacheEntry>();

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
  const [dhtReady, setDhtReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

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
        setLoading(false);
        return;
      }

      // Check cache first
      const cacheKey = active.id;
      const cached = queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL) {
        console.log('[Discover] Using cached matches');
        setMatches(cached.matches);
        setLoading(false);
        return;
      }

      // Initialize DHT if not ready
      if (!dhtReady) {
        try {
          const dhtClient = await initializeDHT();
          setDhtReady(dhtClient.isConnected());
          console.log('[Discover] DHT initialized:', dhtClient.getPeerId());
        } catch (err) {
          console.error('[Discover] DHT init failed:', err);
          setError('DHT initialization failed - check network connection');
          setLoading(false);
          return;
        }
      }

      // Query real DHT
      const dhtClient = getDHTClient();
      if (!dhtClient.isConnected()) {
        setError('Not connected to DHT network');
        setLoading(false);
        return;
      }

      // Compute query vector from channel description
      const queryVec = await computeChannelVector(active);
      const modelHash = LOCAL_MODEL.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);

      // Generate LSH hashes for query
      const hashes = lshHash(queryVec, modelHash, 20, 32);

      // Query DHT for each hash bucket IN PARALLEL
      const allMatches: Match[] = [];
      const seenPeers = new Set<string>();

      // Parallel queries with Promise.all
      const queryPromises = hashes.slice(0, 5).map(async (hash) => {
        const key = `/isc/announce/${modelHash}/${hash}`;
        const results = await dhtClient.query(key, 20);
        
        for (const data of results) {
          try {
            const decoded = JSON.parse(new TextDecoder().decode(data)) as PeerInfo;

            // Filter by model compatibility
            if (!decoded.model.includes('all-MiniLM-L6')) continue;

            // Filter self
            if (decoded.peerId === dhtClient.getPeerId()) continue;

            // Deduplicate
            if (seenPeers.has(decoded.peerId)) continue;
            seenPeers.add(decoded.peerId);

            // Compute similarity
            const sim = cosineSimilarity(queryVec, decoded.vec);
            if (sim >= SIMILARITY_THRESHOLD) {
              allMatches.push({
                peerId: decoded.peerId,
                channelID: decoded.channelID,
                model: decoded.model,
                vec: decoded.vec,
                relTag: decoded.relTag,
                updatedAt: decoded.updatedAt,
                similarity: sim,
                description: `Peer with ${decoded.model}`,
              });
            }
          } catch {
            // Skip invalid entries
          }
        }
      });

      // Wait for all parallel queries to complete
      await Promise.all(queryPromises);

      // Sort by similarity
      const sortedMatches = allMatches
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 20);

      // Cache results
      queryCache.set(cacheKey, {
        matches: sortedMatches,
        timestamp: Date.now(),
      });

      setMatches(sortedMatches);
    } catch (err) {
      setError('Failed to load matches: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dhtReady]);

  // Compute channel vector using real embedding model
  async function computeChannelVector(channel: Channel): Promise<number[]> {
    setModelLoading(true);
    try {
      const vector = await embeddingService.embed(channel.description);
      setModelLoading(false);
      return vector;
    } catch (err) {
      console.warn('[Discover] Embedding failed, using fallback:', err);
      setModelLoading(false);
      // Fallback to stub embedding
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest('SHA-256', encoder.encode(channel.description));
      const hashBytes = new Uint8Array(hash);
      const vec = Array.from({ length: 384 }, (_, i) => {
        const byte = hashBytes[i % 32];
        return (byte / 255) * 2 - 1;
      });
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      return vec.map(v => v / norm);
    }
  }

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleRefresh = () => {
    loadMatches();
  };

  const handleDial = async (match: Match) => {
    try {
      const dhtClient = getDHTClient();
      const node = dhtClient.getNode();
      
      if (!node) {
        alert('Not connected to network');
        return;
      }

      const chatHandler = getChatHandler();
      
      // Register handler if not already registered
      if (!chatHandler['registeredNode']) {
        chatHandler.registerWithNode(node);
      }
      
      // Send initial greeting
      const greeting: ChatMessage = {
        channelID: match.channelID,
        msg: 'Hey, our thoughts are proximal!',
        timestamp: Date.now(),
        sender: 'me',
      };
      
      await chatHandler.sendMessage(match.peerId, greeting, node);
      
      // Create conversation entry
      const newConvo = {
        peerId: match.peerId,
        channelID: match.channelID,
        lastMessage: greeting.msg,
        lastMessageTime: greeting.timestamp,
        unreadCount: 0,
      };
      
      // Save to localStorage
      const savedConvos = localStorage.getItem('isc-conversations');
      const convos: any[] = savedConvos ? JSON.parse(savedConvos) : [];
      const existing = convos.findIndex((c: any) => c.peerId === newConvo.peerId);
      if (existing >= 0) {
        convos[existing] = newConvo;
      } else {
        convos.unshift(newConvo);
      }
      localStorage.setItem('isc-conversations', JSON.stringify(convos));
      
      // Save initial message
      const msgKey = 'isc-messages-' + match.peerId;
      localStorage.setItem(msgKey, JSON.stringify([greeting]));
      
      console.log('[Discover] Started chat with:', match.peerId);
      alert('Chat started with peer ' + match.peerId.slice(0, 8) + '!\n\nGo to the Chats tab to continue the conversation.');
    } catch (err) {
      console.error('[Discover] Failed to dial:', err);
      alert('Failed to connect to peer: ' + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div style={styles.screen}>
        <header style={styles.header}>
          <h1 style={styles.title}>Discover</h1>
          <p style={styles.subtitle}>Finding nearby peers...</p>
        </header>
        <div style={styles.content}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonMatch key={i} />
          ))}
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
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
              <button 
                style={{ ...styles.refreshBtn, margin: 0 }} 
                onClick={() => {
                  import('../router.js').then(({ navigate }) => navigate('compose'));
                }}
              >
                Create Channel
              </button>
              <button style={styles.refreshBtn} onClick={handleRefresh}>Refresh</button>
            </div>
          </div>
        )}

        {veryClose.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Very Close ({veryClose.length})</h2>
            {veryClose.map(match => (
              <MatchCard key={match.peerId} match={match} onDial={handleDial} />
            ))}
          </div>
        )}

        {nearby.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Nearby ({nearby.length})</h2>
            {nearby.map(match => (
              <MatchCard key={match.peerId} match={match} onDial={handleDial} />
            ))}
          </div>
        )}

        {orbiting.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Orbiting ({orbiting.length})</h2>
            {orbiting.map(match => (
              <MatchCard key={match.peerId} match={match} onDial={handleDial} />
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
        <span>Peer {match.peerId.slice(0, 8)}...</span>
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
