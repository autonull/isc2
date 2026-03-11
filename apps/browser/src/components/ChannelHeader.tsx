import { h } from 'preact';
import type { Channel } from '@isc/core';

interface ChannelHeaderProps {
  channel: Channel;
  matchCount?: number;
  onSwitchClick?: () => void;
  onEditClick?: () => void;
}

export function ChannelHeader({
  channel,
  matchCount = 0,
  onSwitchClick,
  onEditClick,
}: ChannelHeaderProps) {
  const formatRelation = (tag: string, object?: string) => (object ? `${tag}: ${object}` : tag);

  return (
    <header class="channel-header">
      <div class="channel-title-row">
        <h2 class="channel-name">{channel.name}</h2>
        <div class="channel-actions">
          <button class="icon-btn" onClick={onSwitchClick} aria-label="Switch channel">
            ▼
          </button>
          <button class="icon-btn" onClick={onEditClick} aria-label="Edit channel">
            ✏️
          </button>
        </div>
      </div>
      {channel.description && <p class="channel-description">{channel.description}</p>}
      <div class="channel-meta">
        {channel.relations.length > 0 && (
          <span class="channel-relations">
            {channel.relations
              .slice(0, 3)
              .map((r) => formatRelation(r.tag, r.object))
              .join(' • ')}
            {channel.relations.length > 3 && ` +${channel.relations.length - 3}`}
          </span>
        )}
        {matchCount > 0 && <span class="channel-match-count">{matchCount} matches</span>}
      </div>
    </header>
  );
}

interface ChannelSwitcherProps {
  channels: Channel[];
  activeChannelId?: string;
  onSelect: (channelId: string) => void;
  onEdit?: (channelId: string) => void;
  onArchive?: (channelId: string) => void;
  onDelete?: (channelId: string) => void;
}

export function ChannelSwitcher({
  channels,
  activeChannelId,
  onSelect,
  onEdit,
  onArchive,
  onDelete,
}: ChannelSwitcherProps) {
  const handleSwipeAction = (channelId: string, action: 'edit' | 'archive' | 'delete') => {
    switch (action) {
      case 'edit':
        onEdit?.(channelId);
        break;
      case 'archive':
        onArchive?.(channelId);
        break;
      case 'delete':
        onDelete?.(channelId);
        break;
    }
  };

  return (
    <div class="channel-switcher">
      <div class="switcher-header">
        <h3>Channels</h3>
      </div>
      <ul class="channel-list">
        {channels.map((channel) => (
          <li
            key={channel.id}
            class={`channel-item ${channel.id === activeChannelId ? 'active' : ''}`}
            onClick={() => onSelect(channel.id)}
          >
            <div class="channel-item-content">
              <span class="channel-item-name">{channel.name}</span>
              {channel.id === activeChannelId && <span class="active-indicator">●</span>}
            </div>
            <div class="channel-item-actions">
              <button
                class="swipe-action"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwipeAction(channel.id, 'edit');
                }}
              >
                Edit
              </button>
              <button
                class="swipe-action"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwipeAction(channel.id, 'archive');
                }}
              >
                Archive
              </button>
              <button
                class="swipe-action delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwipeAction(channel.id, 'delete');
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {channels.length === 0 && <li class="empty-state">No channels yet</li>}
      </ul>
    </div>
  );
}

interface EmptyChannelStateProps {
  onCreateClick: () => void;
}

export function EmptyChannelState({ onCreateClick }: EmptyChannelStateProps) {
  return (
    <div class="empty-channel-state">
      <p>No active channel</p>
      <button class="primary-btn" onClick={onCreateClick}>
        Create Channel
      </button>
    </div>
  );
}
