/**
 * Chats Screen - Real WebRTC Conversations
 * 
 * No mocks - actual P2P chat via libp2p
 */

import { h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getDHTClient, initializeDHT } from '../network/dht.js';
import { getChatHandler, type ChatMessage, type MessageStatus, type TypingIndicator } from '../chat/webrtc.js';
import { channelManager } from '../channels/manager.js';
import { notificationService } from '../chat/notifications.js';
import { sanitizeMessage } from '../utils/sanitize.js';
import { SkeletonConversation } from '../components/Skeleton.js';
import type { Channel } from '@isc/core';

interface Conversation {
  peerId: string;
  channelID: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
}

const CONVERSATIONS_KEY = 'isc-conversations';
const MESSAGES_KEY_PREFIX = 'isc-messages-';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, height: '100%' },
  header: { padding: '16px', borderBottom: '1px solid #e1e8ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  title: { fontSize: '18px', fontWeight: 'bold' as const, margin: 0 },
  content: { flex: 1, overflowY: 'auto' as const },
  conversationCard: { padding: '16px', borderBottom: '1px solid #e1e8ed', cursor: 'pointer' } as const,
  conversationHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } as const,
  peerName: { fontWeight: 'bold' as const, fontSize: '14px' } as const,
  time: { fontSize: '12px', color: '#657786' } as const,
  lastMessage: { fontSize: '14px', color: '#657786', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const,
  empty: { textAlign: 'center' as const, padding: '48px 16px', color: '#657786' } as const,
  emptyIcon: { fontSize: '48px', marginBottom: '16px' } as const,
  refreshBtn: { display: 'block', margin: '16px auto', padding: '8px 24px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } as const,
  chatPanel: { position: 'fixed' as const, bottom: 0, left: 0, right: 0, height: '70%', background: 'white', borderTop: '1px solid #e1e8ed', display: 'flex', flexDirection: 'column' as const, zIndex: 100 } as const,
  chatHeader: { padding: '16px', borderBottom: '1px solid #e1e8ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  chatMessages: { flex: 1, padding: '16px', overflowY: 'auto' as const, background: '#f7f9fa' } as const,
  messageBubble: { padding: '8px 12px', borderRadius: '16px', marginBottom: '8px', maxWidth: '70%', wordWrap: 'break-word' as const, fontSize: '14px' } as const,
  incomingMessage: { background: 'white', alignSelf: 'flex-start', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } as const,
  outgoingMessage: { background: '#1da1f2', color: 'white', alignSelf: 'flex-end', marginLeft: 'auto', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' } as const,
  chatInput: { display: 'flex', padding: '16px', borderTop: '1px solid #e1e8ed', background: 'white' } as const,
  input: { flex: 1, padding: '12px', border: '1px solid #e1e8ed', borderRadius: '20px', fontSize: '14px', marginRight: '8px', outline: 'none' } as const,
  sendBtn: { padding: '8px 24px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' as const } as const,
  closeBtn: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#657786', padding: '0 8px' } as const,
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getMessageStatusIcon(status?: MessageStatus): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'sent': return '✓';
    case 'delivered': return '✓✓';
    case 'failed': return '⚠️';
    default: return '';
  }
}

function getMessageStatusColor(status?: MessageStatus): string {
  switch (status) {
    case 'pending': return '#657786';
    case 'sent': return '#657786';
    case 'delivered': return '#17bf63';
    case 'failed': return '#e0245e';
    default: return '#657786';
  }
}

export function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageStatuses, setMessageStatuses] = useState<Map<number, MessageStatus>>(new Map());
  const [typingPeer, setTypingPeer] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load conversations from localStorage
  const loadConversations = useCallback(() => {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_KEY);
      if (saved) {
        const convos: Conversation[] = JSON.parse(saved);
        setConversations(convos.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)));
      }
    } catch (err) {
      console.error('[Chats] Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load messages for active chat
  const loadMessages = useCallback((peerId: string) => {
    try {
      const saved = localStorage.getItem(MESSAGES_KEY_PREFIX + peerId);
      if (saved) {
        const msgs: ChatMessage[] = JSON.parse(saved);
        setMessages(msgs);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('[Chats] Failed to load messages:', err);
      setMessages([]);
    }
  }, []);

  // Save messages to localStorage
  const saveMessages = useCallback((peerId: string, msgs: ChatMessage[]) => {
    try {
      localStorage.setItem(MESSAGES_KEY_PREFIX + peerId, JSON.stringify(msgs));
    } catch (err) {
      console.error('[Chats] Failed to save messages:', err);
    }
  }, []);

  useEffect(() => {
    loadConversations();

    // Request notification permission on first chat visit
    notificationService.requestPermission();

    // Setup chat handler
    const chatHandler = getChatHandler();
    chatHandler.setOnMessage((msg) => {
      console.log('[Chats] New message:', msg);

      // Show notification for incoming messages from others
      if (msg.sender !== 'me') {
        notificationService.showMessage(msg.sender, msg.msg);
      }

      // Add to messages
      setMessages(prev => {
        const updated = [...prev, msg];
        saveMessages(msg.sender === 'me' ? activeChat?.peerId || 'unknown' : msg.sender, updated);
        return updated;
      });

      // Update conversation and badge
      setConversations(prev => {
        const updated = prev.map(c =>
          c.peerId === msg.sender
            ? { ...c, lastMessage: msg.msg, lastMessageTime: msg.timestamp, unreadCount: c.peerId !== activeChat?.peerId ? c.unreadCount + 1 : c.unreadCount }
            : c
        );
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
        
        // Update badge count
        const totalUnread = updated.reduce((sum, c) => sum + c.unreadCount, 0);
        notificationService.setBadgeCount(totalUnread);
        
        return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      });
    });

    // Setup status update handler
    chatHandler.setOnStatusUpdate((messageId, status) => {
      console.log('[Chats] Message status update:', messageId, status);
      setMessageStatuses(prev => {
        const updated = new Map(prev);
        updated.set(messageId, status);
        return updated;
      });
      // Also update message in localStorage
      if (activeChat) {
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === String(messageId) ? { ...m, status } : m
          );
          saveMessages(activeChat.peerId, updated);
          return updated;
        });
      }
    });

    // Setup typing indicator handler
    chatHandler.setOnTyping((indicator: TypingIndicator) => {
      if (!activeChat) return;
      
      // timestamp 0 means stopped typing
      if (indicator.timestamp === 0 || indicator.sender !== activeChat.peerId) {
        setTypingPeer(null);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      } else {
        setTypingPeer(indicator.sender);
        
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Auto-clear after 3s
        typingTimeoutRef.current = setTimeout(() => {
          setTypingPeer(null);
        }, 3000);
      }
    });

    // Register handler with DHT node
    const registerHandler = async () => {
      const dhtClient = await initializeDHT();
      const node = dhtClient.getNode();
      if (node && !chatHandler['registeredNode']) {
        chatHandler.registerWithNode(node);
      }
    };
    registerHandler();

    // Cross-tab sync for conversations
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CONVERSATIONS_KEY && e.newValue) {
        const convos: Conversation[] = JSON.parse(e.newValue);
        setConversations(convos.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)));
      }
      if (e.key?.startsWith(MESSAGES_KEY_PREFIX) && e.newValue && activeChat) {
        const msgs: ChatMessage[] = JSON.parse(e.newValue);
        setMessages(msgs);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeChat?.peerId, saveMessages]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (convo: Conversation) => {
    // Clear unread count for this conversation
    setConversations(prev => {
      const updated = prev.map(c =>
        c.peerId === convo.peerId ? { ...c, unreadCount: 0 } : c
      );
      const totalUnread = updated.reduce((sum, c) => sum + c.unreadCount, 0);
      notificationService.setBadgeCount(totalUnread);
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
      return updated;
    });
    
    setActiveChat(convo);
    loadMessages(convo.peerId);
  };

  const handleCloseChat = () => {
    setActiveChat(null);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !activeChat) return;

    const message: ChatMessage = {
      channelID: activeChat.channelID,
      msg: inputValue.trim(),
      timestamp: Date.now(),
      sender: 'me',
    };

    try {
      const dhtClient = getDHTClient();
      const node = dhtClient.getNode();
      const chatHandler = getChatHandler();

      if (!node) {
        alert('Not connected to network');
        return;
      }

      await chatHandler.sendMessage(activeChat.peerId, message, node);

      // Add to local messages
      const updatedMessages = [...messages, message];
      setMessages(updatedMessages);
      saveMessages(activeChat.peerId, updatedMessages);

      // Update conversation
      const updatedConvos = conversations.map(c =>
        c.peerId === activeChat.peerId
          ? { ...c, lastMessage: message.msg, lastMessageTime: message.timestamp }
          : c
      );
      setConversations(updatedConvos);
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updatedConvos));

      setInputValue('');
    } catch (err) {
      console.error('[Chats] Failed to send message:', err);
      alert('Failed to send message: ' + (err as Error).message);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    
    // Send typing indicator if there's input and we have an active chat
    if (value.trim() && activeChat) {
      const dhtClient = getDHTClient();
      const node = dhtClient.getNode();
      if (node) {
        const chatHandler = getChatHandler();
        chatHandler.sendTypingIndicator(activeChat.peerId, activeChat.channelID, node);
      }
    }
  };

  if (loading) {
    return (
      <div style={styles.screen}>
        <header style={styles.header}>
          <h1 style={styles.title}>Chats</h1>
        </header>
        <div style={styles.content}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonConversation key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <h1 style={styles.title}>Chats</h1>
      </header>

      <div style={styles.content}>
        {conversations.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>💬</div>
            <p>No conversations yet</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Find peers in Discover to start chatting
            </p>
            <button 
              style={{ ...styles.refreshBtn, margin: '16px auto 0' }} 
              onClick={() => {
                import('../router.js').then(({ navigate }) => navigate('discover'));
              }}
            >
              Find Peers
            </button>
          </div>
        ) : (
          conversations.map(convo => (
            <div
              key={convo.peerId}
              style={styles.conversationCard}
              onClick={() => handleSelectConversation(convo)}
            >
              <div style={styles.conversationHeader}>
                <span style={styles.peerName}>Peer {convo.peerId.slice(0, 8)}...</span>
                {convo.lastMessageTime && (
                  <span style={styles.time}>{timeAgo(convo.lastMessageTime)}</span>
                )}
              </div>
              {convo.lastMessage && (
                <div style={styles.lastMessage}>{convo.lastMessage}</div>
              )}
            </div>
          ))
        )}
      </div>

      {activeChat && (
        <div style={styles.chatPanel}>
          <header style={styles.chatHeader}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px' }}>
                Peer {activeChat.peerId.slice(0, 8)}...
              </h2>
              <span style={{ fontSize: '12px', color: typingPeer ? '#17bf63' : '#657786' }}>
                {typingPeer ? 'Peer is typing...' : (activeChat.lastMessageTime ? 'Active ' + timeAgo(activeChat.lastMessageTime) : '')}
              </span>
            </div>
            <button style={styles.closeBtn} onClick={handleCloseChat}>×</button>
          </header>

          <div style={styles.chatMessages}>
            {messages.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#657786', fontSize: '14px' }}>
                Say hello to start the conversation!
              </p>
            ) : (
              messages.map((msg, index) => {
                const isOutgoing = msg.sender === 'me';
                const statusIcon = isOutgoing ? getMessageStatusIcon(msg.status) : '';
                const statusColor = isOutgoing ? getMessageStatusColor(msg.status) : '';
                
                return (
                  <div
                    key={index}
                    style={{
                      ...styles.messageBubble,
                      ...(isOutgoing ? styles.outgoingMessage : styles.incomingMessage),
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '4px',
                    }}
                  >
                    <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: sanitizeMessage(msg.msg) }} />
                    {statusIcon && (
                      <span style={{ fontSize: '12px', color: statusColor, minWidth: '20px' }}>
                        {statusIcon}
                      </span>
                    )}
                  </div>
                );
              })
            )}
            
            {/* Typing indicator */}
            {typingPeer && (
              <div style={{ ...styles.messageBubble, ...styles.incomingMessage, display: 'inline-block' }}>
                <span style={{ fontSize: '14px', color: '#657786' }}>
                  <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
                  <span style={{ animation: 'pulse 1.5s infinite 0.2s' }}>●</span>
                  <span style={{ animation: 'pulse 1.5s infinite 0.4s' }}>●</span>
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.chatInput}>
            <input
              type="text"
              value={inputValue}
              onInput={(e) => handleInputChange((e.target as HTMLInputElement).value)}
              placeholder="Type a message..."
              style={styles.input}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
            />
            <button style={styles.sendBtn} onClick={handleSendMessage}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
