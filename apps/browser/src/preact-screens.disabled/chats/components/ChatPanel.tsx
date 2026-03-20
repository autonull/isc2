/**
 * Chat Panel Component
 */

import { h } from 'preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import type { ChatMessage } from '../../../chat/webrtc.js';
import { getDHTClient } from '../../../network/dht.js';
import { getChatHandler } from '../../../chat/webrtc.js';
import { sanitizeMessage } from '../../../utils/sanitize.js';
import { timeAgo, getMessageStatusIcon, getMessageStatusColor } from '../utils/messageFormatter.js';
import { MessageBubble } from './MessageBubble.js';
import { TypingIndicator } from './TypingIndicator.js';
import type { Conversation } from '../types.js';
import '../styles/ChatsScreen.css';

interface ChatPanelProps {
  activeChat: Conversation;
  messages: ChatMessage[];
  messageStatuses: Map<number, string>;
  typingPeer: string | null;
  onClose: () => void;
  onSendMessage: (message: string) => Promise<void>;
  onSendTyping: () => void;
}

export function ChatPanel({
  activeChat,
  messages,
  messageStatuses,
  typingPeer,
  onClose,
  onSendMessage,
  onSendTyping,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    await onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (value.trim()) {
        onSendTyping();
      }
    },
    [onSendTyping]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        handleSendMessage();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inputValue]);

  return (
    <div class="chat-panel">
      <header class="chat-header">
        <div>
          <h2 class="chat-header-title">
            Peer {activeChat.peerId.slice(0, 8)}...
          </h2>
          <span
            class={`chat-header-status ${typingPeer ? 'typing' : ''}`}
          >
            {typingPeer
              ? 'Peer is typing...'
              : activeChat.lastMessageTime
              ? 'Active ' + timeAgo(activeChat.lastMessageTime)
              : ''}
          </span>
        </div>
        <button class="chat-close-btn" onClick={onClose}>
          ×
        </button>
      </header>

      <div class="chat-messages">
        {messages.length === 0 ? (
          <p class="chat-messages-empty">Say hello to start the conversation!</p>
        ) : (
          messages.map((msg, index) => {
            const isOutgoing = msg.sender === 'me';
            const statusIcon = isOutgoing
              ? getMessageStatusIcon(msg.status)
              : '';
            const statusColor = isOutgoing
              ? getMessageStatusColor(msg.status)
              : '';

            return (
              <MessageBubble
                key={index}
                message={msg}
                statusIcon={statusIcon}
                statusColor={statusColor}
              />
            );
          })
        )}

        <TypingIndicator isTyping={!!typingPeer} />
        <div ref={messagesEndRef} />
      </div>

      <div class="chat-input">
        <input
          type="text"
          value={inputValue}
          onInput={e => handleInputChange((e.target as HTMLInputElement).value)}
          placeholder="Type a message..."
          class="chat-input-field"
        />
        <button class="chat-send-btn" onClick={handleSendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
