/**
 * Chats Screen - Direct Messages with Discovered Peers
 *
 * Shows conversation list and message view.
 * Uses WebRTC for peer-to-peer encrypted messaging.
 */

import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useDependencies } from '../di/container.js';
import { useNavigation } from '@isc/navigation';
import type { PeerMatch } from '@isc/network';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#f5f8fa' } as const,
  header: { padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white' } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  content: { flex: 1, display: 'flex', background: 'white', borderTop: '1px solid #e1e8ed' } as const,
  sidebar: { width: '320px', borderRight: '1px solid #e1e8ed', background: 'white', overflowY: 'auto' as const } as const,
  main: { flex: 1, display: 'flex', flexDirection: 'column' as const, background: '#f5f8fa' } as const,
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', color: '#657786', padding: '40px' } as const,
  conversationItem: { padding: '12px 16px', borderBottom: '1px solid #e1e8ed', cursor: 'pointer', transition: 'background 0.2s' } as const,
  conversationActive: { background: '#e8f4fd' } as const,
  conversationName: { fontWeight: 'bold' as const, fontSize: '14px', color: '#14171a', marginBottom: '4px' } as const,
  conversationPreview: { fontSize: '13px', color: '#657786', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const,
  messageInput: { padding: '16px', borderTop: '1px solid #e1e8ed', background: 'white', display: 'flex', gap: '12px' } as const,
  input: { flex: 1, padding: '12px 16px', border: '1px solid #e1e8ed', borderRadius: '20px', fontSize: '14px', outline: 'none' } as const,
  sendBtn: { padding: '12px 24px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' as const, cursor: 'pointer' } as const,
  messageList: { flex: 1, padding: '20px', overflowY: 'auto' as const } as const,
  messageBubble: { maxWidth: '70%', padding: '12px 16px', borderRadius: '18px', marginBottom: '12px', fontSize: '14px', lineHeight: 1.4 } as const,
  messageSent: { background: '#1da1f2', color: 'white', marginLeft: 'auto' } as const,
  messageReceived: { background: '#e1e8ed', color: '#14171a' } as const,
  messageTime: { fontSize: '11px', opacity: 0.7, marginTop: '4px' } as const,
  offlineBanner: { background: '#fff3cd', color: '#856404', padding: '8px 20px', fontSize: '13px', textAlign: 'center' as const, borderBottom: '1px solid #ffc107' } as const,
  card: { background: '#f7f9fa', borderRadius: '12px', padding: '20px', marginTop: '20px', maxWidth: '400px' } as const,
  matchBadge: { fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#e8f4fd', color: '#1da1f2', marginLeft: '8px' } as const,
};

interface Conversation {
  id: string;
  peer: PeerMatch['peer'];
  similarity: number;
  lastMessage?: string;
  timestamp?: number;
  unread: number;
}

interface Message {
  id: string;
  conversationId: string;
  content: string;
  fromMe: boolean;
  timestamp: number;
}

export function ChatsScreen() {
  const { networkService } = useDependencies();
  const { navigate } = useNavigation();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Load conversations from matches
  useEffect(() => {
    if (!networkService) return;

    const matches = networkService.getMatches();
    const convos: Conversation[] = matches.map(match => ({
      id: match.peer.id,
      peer: match.peer,
      similarity: match.similarity,
      unread: 0,
    }));

    setConversations(convos);

    let unsubscribeFn: () => void = () => {};
    try {
      unsubscribeFn = networkService.on({
        onPeerDiscovered: (match: any) => {
          setConversations(prev => {
            if (prev.some(c => c.id === match.peer.id)) return prev;
            return [{
              id: match.peer.id,
              peer: match.peer,
              similarity: match.similarity,
              unread: 0,
            }, ...prev];
          });
        },
      });
    } catch (e) {
      console.warn('[Chats] Failed to subscribe to network updates:', e);
    }

    return () => {
      if (typeof unsubscribeFn === 'function') {
        unsubscribeFn();
      }
    };
  }, [networkService]);

  // Handle online/offline
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Select conversation
  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    // Load messages for this conversation (from local storage)
    const stored = localStorage.getItem(`isc-messages-${conversationId}`);
    setMessages(stored ? JSON.parse(stored) : []);
  };

  // Send message via WebRTC with localStorage fallback
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedConversation) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId: selectedConversation,
      content: inputValue.trim(),
      fromMe: true,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);
    localStorage.setItem(`isc-messages-${selectedConversation}`, JSON.stringify([...messages, newMessage]));

    // Update conversation preview
    setConversations(prev => prev.map(c =>
      c.id === selectedConversation
        ? { ...c, lastMessage: inputValue.trim(), timestamp: Date.now() }
        : c
    ));

    setInputValue('');

    // Send via WebRTC using chat service
    try {
      const chatService = await import('../services/chatService.js');
      const service = chatService.getChatService();
      await service.send(selectedConversation, newMessage.content);
      console.log('[Chats] Message sent via WebRTC:', newMessage.id);
    } catch (err) {
      // Fallback: message already stored locally, will sync when online
      console.warn('[Chats] WebRTC send failed, message queued locally:', err);
    }
  };

  // Navigate to discover to find more peers
  const handleGoToDiscover = () => {
    navigate({ name: 'discover', path: '/discover' });
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>💬 Chats</h1>
      </div>

      {isOffline && (
        <div style={styles.offlineBanner} data-testid="offline-indicator">
          📡 You're offline — messages will be queued and sent when reconnected
        </div>
      )}

      <div style={styles.content}>
        {/* Conversation List */}
        <div style={styles.sidebar} data-testid="conversation-list">
          {conversations.length === 0 ? (
            <div style={{ padding: '20px', color: '#657786', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>💭</div>
              <p style={{ fontSize: '14px', marginBottom: '12px' }}>No conversations yet</p>
              <button
                onClick={handleGoToDiscover}
                style={{ padding: '8px 16px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '20px', fontSize: '13px', cursor: 'pointer' }}
              >
                🔍 Discover Peers
              </button>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                style={{
                  ...styles.conversationItem,
                  ...(conv.id === selectedConversation ? styles.conversationActive : {}),
                }}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <div style={styles.conversationName}>
                  {conv.peer.name || 'Anonymous'}
                  <span style={styles.matchBadge}>{Math.round(conv.similarity * 100)}% match</span>
                </div>
                <div style={styles.conversationPreview}>
                  {conv.lastMessage || 'Start a conversation...'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message View */}
        <div style={styles.main}>
          {selectedConversation && selectedConv ? (
            <>
              {/* Messages */}
              <div style={styles.messageList}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#657786' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>👋</div>
                    <p>Say hello to {selectedConv.peer.name || 'this peer'}!</p>
                    <p style={{ fontSize: '12px', marginTop: '8px' }}>
                      Similarity: {Math.round(selectedConv.similarity * 100)}% match
                    </p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        ...styles.messageBubble,
                        ...(msg.fromMe ? styles.messageSent : styles.messageReceived),
                      }}
                    >
                      {msg.content}
                      <div style={styles.messageTime}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div style={styles.messageInput}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue((e.target as HTMLInputElement).value)}
                  onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  style={styles.input}
                  data-testid="message-input"
                />
                <button
                  onClick={handleSendMessage}
                  style={styles.sendBtn}
                  data-testid="send-message-button"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>💬</div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#14171a' }}>Select a Conversation</h2>
              <p style={{ margin: 0, fontSize: '14px', textAlign: 'center' }}>
                Choose a conversation from the sidebar or discover new peers.
              </p>

              <div style={styles.card}>
                <h4 style={{ margin: '0 0 10px 0', color: '#1da1f2', fontSize: '14px' }}>🔐 Encrypted Messaging</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#657786', lineHeight: 1.8 }}>
                  <li>End-to-end encrypted messages</li>
                  <li>Peer-to-peer via WebRTC</li>
                  <li>No central server storage</li>
                  <li>Messages matched by semantic similarity</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
