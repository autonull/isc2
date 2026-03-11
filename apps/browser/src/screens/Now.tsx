/**
 * Now Screen
 * 
 * Main feed view showing posts from all channels.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Feed } from '../components/Feed.js';
import { ComposePost } from '../components/ComposePost.js';
import { channelManager } from '../channels/manager.js';
import type { Channel } from '@isc/core';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #e1e8ed', position: 'sticky' as const, top: 0, background: 'white', zIndex: 100 } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0 } as const,
  composeBtn: { padding: '8px 16px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' as const, cursor: 'pointer' } as const,
};

export function NowScreen() {
  const [showCompose, setShowCompose] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const handleComposeClick = async () => {
    const channels = await channelManager.getAllChannels();
    const active = channels.find((c) => c.active) || channels[0] || null;
    setActiveChannel(active);
    setShowCompose(true);
  };

  const handlePost = () => {
    setShowCompose(false);
    // Could refresh feed here
  };

  const handleCancel = () => {
    setShowCompose(false);
  };

  return (
    <div style={styles.screen}>
      {showCompose ? (
        <ComposePost
          channel={activeChannel}
          onPost={handlePost}
          onCancel={handleCancel}
        />
      ) : (
        <div style={styles.header}>
          <h1 style={styles.title}>Now</h1>
          <button onClick={handleComposeClick} style={styles.composeBtn}>
            + Post
          </button>
        </div>
      )}

      <Feed type="for-you" />
    </div>
  );
}
