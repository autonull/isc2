import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { router, currentRoute, navigate, initRouter } from './router.js';
import type { Route } from './router.js';
import { ChannelHeader } from './components/ChannelHeader.js';
import { TopNav } from './components/TopNav.js';
import { PWAInstallPrompt } from './components/PWAInstallPrompt.js';
import { ConnectionStatusIndicator } from './components/ConnectionStatusIndicator.js';
import { channelManager } from './channels/manager.js';
import type { Channel } from '@isc/core';
import { usePullToRefresh } from './hooks/usePullToRefresh.js';
import { initConnectionMonitor, initSyncManager, isOnline } from './offline/index.js';
import { NowScreen } from './screens/Now.js';
import { FollowingScreen } from './screens/Following.js';

interface AppProps {
  onReady?: () => void;
}

export function App({ onReady }: AppProps) {
  const [route, setRoute] = useState<Route>(currentRoute());
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [showChannelSwitcher, setShowChannelSwitcher] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({
    now: 0,
    chats: 0,
  });
  const [isDesktop, setIsDesktop] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initialize offline-first features
    initConnectionMonitor();
    initSyncManager();
    
    initRouter();
    onReady?.();

    channelManager.getAllChannels().then((chs) => {
      setChannels(chs);
      const active = chs.find((c) => c.active) || null;
      setActiveChannel(active);
    });

    const unsubscribe = router.onChange((newRoute) => {
      setRoute(newRoute);
    });

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    checkDesktop();
    window.addEventListener('resize', checkDesktop);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', checkDesktop);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Re-fetch channels and trigger match query
      const chs = await channelManager.getAllChannels();
      setChannels(chs);
      const active = chs.find((c) => c.active) || null;
      setActiveChannel(active);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
  });

  const handleTabClick = (tabId: Route) => {
    navigate(tabId);
  };

  const handleChannelSwitch = () => {
    setShowChannelSwitcher(true);
  };

  const handleChannelSelect = async (channelId: string) => {
    setShowChannelSwitcher(false);
    try {
      await channelManager.activateChannel(channelId, []);
      const ch = await channelManager.getChannel(channelId);
      if (ch) setActiveChannel(ch);
    } catch (err) {
      console.error('Failed to activate channel:', err);
    }
  };

  return (
    <div class="app">
      <div class={`ptr-indicator ${isRefreshing ? 'visible' : ''}`}>
        <div class="ptr-spinner" />
      </div>
      {isDesktop && activeChannel && (
        <ChannelHeader
          channel={activeChannel}
          matchCount={badges.now}
          onSwitchClick={handleChannelSwitch}
          onEditClick={() => navigate('compose')}
        />
      )}
      {showChannelSwitcher && (
        <ChannelSwitcherOverlay
          channels={channels}
          activeChannelId={activeChannel?.id}
          onSelect={handleChannelSelect}
          onClose={() => setShowChannelSwitcher(false)}
        />
      )}
      <main class="app-content">
        <Screen route={route} />
      </main>
      {isDesktop ? (
        <TopNav activeTab={route} onTabClick={handleTabClick} badges={badges} />
      ) : (
        <TabBar activeTab={route} onTabClick={handleTabClick} badges={badges} />
      )}
      {/* PWA Components */}
      {!isDesktop && <ConnectionStatusIndicator />}
      <PWAInstallPrompt />
    </div>
  );
}

function ChannelSwitcherOverlay({
  channels,
  activeChannelId,
  onSelect,
  onClose,
}: {
  channels: Channel[];
  activeChannelId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div class="overlay" onClick={onClose}>
      <div class="switcher-sheet" onClick={(e) => e.stopPropagation()}>
        <div class="switcher-header">
          <h3>Channels</h3>
          <button class="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <ul class="channel-list">
          {channels.map((channel) => (
            <li
              key={channel.id}
              class={`channel-item ${channel.id === activeChannelId ? 'active' : ''}`}
              onClick={() => onSelect(channel.id)}
            >
              <span>{channel.name}</span>
              {channel.id === activeChannelId && <span class="active-dot">●</span>}
            </li>
          ))}
          {channels.length === 0 && <li class="empty">No channels</li>}
        </ul>
      </div>
    </div>
  );
}

function Screen({ route }: { route: Route }) {
  switch (route) {
    case 'now':
      return <NowScreen />;
    case 'following':
      return <FollowingScreen />;
    case 'discover':
      return <DiscoverScreen />;
    case 'compose':
      return <ComposeScreen />;
    case 'chats':
      return <ChatsScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <NowScreen />;
  }
}

function DiscoverScreen() {
  return (
    <div class="screen discover-screen">
      <header class="screen-header">
        <h1>Discover</h1>
      </header>
      <div class="screen-content">
        <p>Find nearby peers</p>
      </div>
    </div>
  );
}

function ComposeScreen() {
  return (
    <div class="screen compose-screen">
      <header class="screen-header">
        <h1>New Channel</h1>
      </header>
      <div class="screen-content">
        <p>Create a new channel</p>
      </div>
    </div>
  );
}

function ChatsScreen() {
  return (
    <div class="screen chats-screen">
      <header class="screen-header">
        <h1>Chats</h1>
      </header>
      <div class="screen-content">
        <p>Your conversations</p>
      </div>
    </div>
  );
}

function SettingsScreen() {
  return (
    <div class="screen settings-screen">
      <header class="screen-header">
        <h1>Settings</h1>
      </header>
      <div class="screen-content">
        <p>Configure your app</p>
      </div>
    </div>
  );
}

interface TabBarProps {
  activeTab: Route;
  onTabClick: (tabId: Route) => void;
  badges?: Record<string, number>;
}

function TabBar({ activeTab, onTabClick, badges = {} }: TabBarProps) {
  const tabs: { id: Route; label: string; icon: string; special?: boolean }[] = [
    { id: 'now', label: 'Now', icon: '🏠' },
    { id: 'discover', label: 'Discover', icon: '📡' },
    { id: 'compose', label: '', icon: '➕', special: true },
    { id: 'chats', label: 'Chats', icon: '💬' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav class="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          class={`tab ${tab.special ? 'compose' : ''} ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabClick(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <span class="tab-icon">{tab.icon}</span>
          {!tab.special && <span class="tab-label">{tab.label}</span>}
          {badges[tab.id] !== undefined && badges[tab.id] > 0 && (
            <span class="badge">{badges[tab.id]}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
