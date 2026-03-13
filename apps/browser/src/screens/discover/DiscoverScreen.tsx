/**
 * Discover Screen - Find Nearby Peers
 *
 * Main container component using modular architecture.
 */

import { h, Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { usePeerDiscovery } from './hooks/usePeerDiscovery.js';
import { usePeerFiltering } from './hooks/usePeerFiltering.js';
import { useMatchScoring } from './hooks/useMatchScoring.js';
import { PeerList } from './components/PeerList.js';
import { FilterBar } from './components/FilterBar.js';
import { EmptyState } from './components/EmptyState.js';
import { MatchIndicator } from './components/MatchIndicator.js';
import { SkeletonMatch } from '../../components/Skeleton.js';
import { discoverStyles as styles } from './styles/Discover.css.js';
import type { Match } from './types/discover.js';
import { getChatHandler } from '../../chat/webrtc.js';
import { getDHTClient } from '../../network/dht.js';
import { navigate } from '../../router.js';

export function DiscoverScreen() {
  const {
    matches,
    loading,
    error,
    activeChannel,
    loadMatches,
    refreshMatches,
  } = usePeerDiscovery();

  const { filteredMatches, groupedMatches } = usePeerFiltering(matches);
  const { scoredMatches } = useMatchScoring(matches);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleDial = async (match: Match) => {
    try {
      const dhtClient = getDHTClient();
      const node = dhtClient.getNode();

      if (!node) {
        alert('Not connected to network');
        return;
      }

      const chatHandler = getChatHandler();

      if (!chatHandler['registeredNode']) {
        chatHandler.registerWithNode(node);
      }

      const greeting = {
        channelID: match.channelID,
        msg: 'Hey, our thoughts are proximal!',
        timestamp: Date.now(),
        sender: 'me',
      };

      await chatHandler.sendMessage(match.peerId, greeting, node);

      const newConvo = {
        peerId: match.peerId,
        channelID: match.channelID,
        lastMessage: greeting.msg,
        lastMessageTime: greeting.timestamp,
        unreadCount: 0,
      };

      const savedConvos = localStorage.getItem('isc-conversations');
      const convos = savedConvos ? JSON.parse(savedConvos) : [];
      const existing = convos.findIndex(
        (c: any) => c.peerId === newConvo.peerId
      );
      if (existing >= 0) {
        convos[existing] = newConvo;
      } else {
        convos.unshift(newConvo);
      }
      localStorage.setItem('isc-conversations', JSON.stringify(convos));

      const msgKey = `isc-messages-${match.peerId}`;
      localStorage.setItem(msgKey, JSON.stringify([greeting]));

      alert(
        `Chat started with peer ${match.peerId.slice(0, 8)}!\n\nGo to the Chats tab to continue the conversation.`
      );
    } catch (err) {
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
          <EmptyState
            icon="⚠️"
            title="Connection Error"
            message={error}
            actions={[
              { label: 'Try Again', onClick: refreshMatches, primary: true },
            ]}
          />
        )}

        {!error && matches.length === 0 && (
          <EmptyState
            icon="🔍"
            title="No matches found"
            message={
              activeChannel
                ? 'Try editing your channel description or wait for more peers to announce'
                : 'Create a channel to start discovering peers'
            }
            actions={[
              {
                label: 'Create Channel',
                onClick: () => navigate('now'),
                primary: true,
              },
              { label: 'Refresh', onClick: refreshMatches },
            ]}
          />
        )}

        {!error && matches.length > 0 && (
          <>
            <FilterBar />

            {groupedMatches.VERY_CLOSE.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                  Very Close ({groupedMatches.VERY_CLOSE.length})
                </h2>
                <PeerList
                  matches={groupedMatches.VERY_CLOSE}
                  onDial={handleDial}
                />
              </div>
            )}

            {groupedMatches.NEARBY.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                  Nearby ({groupedMatches.NEARBY.length})
                </h2>
                <PeerList
                  matches={groupedMatches.NEARBY}
                  onDial={handleDial}
                />
              </div>
            )}

            {groupedMatches.ORBITING.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                  Orbiting ({groupedMatches.ORBITING.length})
                </h2>
                <PeerList
                  matches={groupedMatches.ORBITING}
                  onDial={handleDial}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
