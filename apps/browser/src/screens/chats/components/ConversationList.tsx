/**
 * Conversation List Component
 */

import { h, Fragment } from 'preact';
import type { Conversation } from '../types.js';
import { timeAgo } from '../utils/messageFormatter.js';
import '../styles/ChatsScreen.css';

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (convo: Conversation) => void;
}

export function ConversationList({ conversations, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div class="chats-empty">
        <div class="chats-empty-icon">💬</div>
        <p>No conversations yet</p>
        <p style={{ fontSize: '14px', marginTop: '8px' }}>
          Find peers in Discover to start chatting
        </p>
        <button
          class="chats-refresh-btn"
          onClick={() => {
            import('../../../router.js').then(({ navigate }) => navigate('discover'));
          }}
        >
          Find Peers
        </button>
      </div>
    );
  }

  return (
    <Fragment>
      {conversations.map(convo => (
        <div
          key={convo.peerId}
          class="conversation-card"
          onClick={() => onSelect(convo)}
        >
          <div class="conversation-header">
            <span class="conversation-peer-name">Peer {convo.peerId.slice(0, 8)}...</span>
            {convo.lastMessageTime && (
              <span class="conversation-time">{timeAgo(convo.lastMessageTime)}</span>
            )}
          </div>
          {convo.lastMessage && (
            <div class="conversation-last-message">{convo.lastMessage}</div>
          )}
        </div>
      ))}
    </Fragment>
  );
}
