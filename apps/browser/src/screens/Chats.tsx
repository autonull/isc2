import { h } from 'preact';
import { useState } from 'preact/hooks';

interface Chat {
  id: string;
  peerId: string;
  peerName: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
}

interface ChatsScreenProps {
  chats: Chat[];
  onSelectChat: (chatId: string) => void;
}

export function ChatsScreen({ chats, onSelectChat }: ChatsScreenProps) {
  const formatTime = (ts: number): string => {
    const now = Date.now();
    const diff = now - ts;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div class="screen chats-screen">
      <header class="screen-header">
        <h1>Chats</h1>
      </header>

      {chats.length === 0 ? (
        <div class="empty-state">
          <p>No conversations yet</p>
          <p class="hint">Discover peers to start chatting</p>
        </div>
      ) : (
        <ul class="chat-list">
          {chats.map((chat) => (
            <li key={chat.id} class="chat-item" onClick={() => onSelectChat(chat.id)}>
              <div class="chat-avatar">{chat.peerName.charAt(0).toUpperCase()}</div>
              <div class="chat-content">
                <div class="chat-header">
                  <span class="chat-name">{chat.peerName}</span>
                  <span class="chat-time">{formatTime(chat.timestamp)}</span>
                </div>
                <p class="chat-preview">{chat.lastMessage}</p>
              </div>
              {chat.unread > 0 && <span class="unread-badge">{chat.unread}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered';
}

interface ChatDetailScreenProps {
  chat: Chat;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onBack: () => void;
}

export function ChatDetailScreen({ chat, messages, onSendMessage, onBack }: ChatDetailScreenProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const formatTime = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div class="screen chat-detail-screen">
      <header class="chat-header-bar">
        <button class="back-btn" onClick={onBack}>
          ←
        </button>
        <span class="chat-peer-name">{chat.peerName}</span>
      </header>

      <div class="messages-list">
        {messages.map((msg) => (
          <div key={msg.id} class={`message ${msg.senderId === 'me' ? 'outgoing' : 'incoming'}`}>
            <div class="message-bubble">
              <p>{msg.text}</p>
              <span class="message-time">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>

      <div class="message-input">
        <input
          type="text"
          value={input}
          onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <button onClick={handleSend} disabled={!input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
