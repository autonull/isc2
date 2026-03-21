import { h } from 'preact';
import type { Route } from '../types.js';
import type { Channel } from '@isc/core';

interface IRCSidebarProps {
  activeTab: Route;
  onTabClick: (tabId: Route) => void;
  badges?: Record<string, number>;
  channels: Channel[];
  activeChannelId?: string;
  onChannelSelect?: (id: string) => void;
  connectionStatus?: 'online' | 'offline' | 'slow';
}

const TABS: Array<{ id: Route; label: string; icon: string; special?: boolean }> = [
  { id: 'now', label: 'Now', icon: '🏠' },
  { id: 'discover', label: 'Discover', icon: '📡' },
  { id: 'video', label: 'Video', icon: '📹' },
  { id: 'chats', label: 'Chats', icon: '💬' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'compose', label: 'New Match', icon: '➕', special: true },
];

export function IRCSidebar({
  activeTab,
  onTabClick,
  badges = {},
  channels,
  activeChannelId,
  onChannelSelect,
  connectionStatus = 'online'
}: IRCSidebarProps) {
  return (
    <aside class="irc-sidebar" data-testid="sidebar" data-component="irc-sidebar">
      <div class="irc-brand" data-testid="sidebar-brand" data-component="irc-brand">
        ISC
        <span class={`connection-indicator status-${connectionStatus}`} data-testid="connection-status" title={`Connection: ${connectionStatus}`}>
          ●
        </span>
      </div>

      <ul class="irc-nav-list" data-testid="sidebar-nav-list" data-component="irc-nav-list">
        {TABS.map((tab) => (
          <li
            key={tab.id}
            class={`irc-nav-item ${tab.special ? 'compose' : ''} ${activeTab === tab.id ? 'active' : ''}`}
            data-testid={`nav-tab-${tab.id}`}
            data-tab={tab.id}
            data-active={activeTab === tab.id}
            onClick={() => onTabClick(tab.id as Route)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span class="irc-nav-icon" data-testid={`nav-tab-${tab.id}-icon`}>{tab.icon}</span>
            <span class="irc-nav-label" data-testid={`nav-tab-${tab.id}-label`}>{tab.label}</span>
            {badges[tab.id] !== undefined && badges[tab.id] > 0 && (
              <span class="irc-nav-badge" data-testid={`nav-tab-${tab.id}-badge`} data-badge>{badges[tab.id]}</span>
            )}
          </li>
        ))}
      </ul>

      <div class="irc-channels-header" data-testid="sidebar-channels-header" data-component="irc-channels-header">Channels</div>
      <ul class="irc-channel-list" data-testid="sidebar-channel-list" data-component="irc-channel-list">
        {channels.map((channel) => (
          <li
            key={channel.id}
            class={`irc-channel-item ${channel.id === activeChannelId ? 'active' : ''}`}
            data-testid={`sidebar-channel-${channel.id}`}
            data-channel-id={channel.id}
            data-active={channel.id === activeChannelId}
            onClick={() => onChannelSelect?.(channel.id)}
          >
            <span class="irc-channel-name" data-testid={`sidebar-channel-${channel.id}-name`}># {channel.name}</span>
          </li>
        ))}
        {channels.length === 0 && <li class="empty" data-testid="sidebar-no-channels" data-empty style={{ padding: '16px', color: '#999', fontSize: '14px' }}>No channels</li>}
      </ul>
    </aside>
  );
}
