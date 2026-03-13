import { h } from 'preact';
import type { Route } from '../types.js';

interface TopNavProps {
  activeTab: Route;
  onTabClick: (tabId: Route) => void;
  badges?: Record<string, number>;
}

const TABS: Array<{ id: Route; label: string; icon: string; special?: boolean }> = [
  { id: 'now', label: 'Now', icon: '🏠' },
  { id: 'discover', label: 'Discover', icon: '📡' },
  { id: 'video', label: 'Video', icon: '📹' },
  { id: 'compose', label: 'Compose', icon: '➕', special: true },
  { id: 'chats', label: 'Chats', icon: '💬' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function TopNav({ activeTab, onTabClick, badges = {} }: TopNavProps) {
  return (
    <nav class="top-nav">
      <div class="top-nav-container">
        <div class="top-nav-brand">ISC</div>
        <div class="top-nav-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              class={`top-nav-tab ${tab.special ? 'compose' : ''} ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabClick(tab.id as Route)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span class="top-nav-tab-icon">{tab.icon}</span>
              <span class="top-nav-tab-label">{tab.label}</span>
              {badges[tab.id] !== undefined && badges[tab.id] > 0 && (
                <span class="top-nav-badge">{badges[tab.id]}</span>
              )}
            </button>
          ))}
        </div>
        <div class="top-nav-actions">
          <button class="top-nav-btn" aria-label="Notifications">
            🔔
          </button>
          <button class="top-nav-btn" aria-label="Menu">
            ☰
          </button>
        </div>
      </div>
    </nav>
  );
}
