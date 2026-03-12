/**
 * Chats Screen - Real WebRTC Conversations
 * 
 * No mocks - actual P2P chat via libp2p
 */

import { h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getDHTClient, initializeDHT } from '../network/dht.js';
import { getChatHandler, type ChatMessage } from '../chat/webrtc.js';
import { channelManager } from '../channels/manager.js';
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

export function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Setup chat handler
    const chatHandler = getChatHandler();
    chatHandler.setOnMessage((msg) => {
      console.log('[Chats] New message:', msg);
      
      // Add to messages
      setMessages(prev => {
        const updated = [...prev, msg];
        saveMessages(msg.sender === 'me' ? activeChat?.peerId || 'unknown' : msg.sender, updated);
        return updated;
      });

      // Update conversation
      setConversations(prev => {
        const updated = prev.map(c => 
          c.peerId === msg.sender 
            ? { ...c, lastMessage: msg.msg, lastMessageTime: msg.timestamp }
            : c
        );
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
        return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      });
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

    return () => {
      // Don't close all streams on unmount, just this screen
    };
  }, [activeChat?.peerId, saveMessages]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (convo: Conversation) => {
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

  if (loading) {
    return (
      <div style={styles.screen}>
        <header style={styles.header}>
          <h1 style={styles.title}>Chats</h1>
        </header>
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <p>Loading conversations...</p>
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
              <span style={{ fontSize: '12px', color: '#657786' }}>
                {activeChat.lastMessageTime ? 'Active ' + timeAgo(activeChat.lastMessageTime) : ''}
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
              messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    ...styles.messageBubble,
                    ...(msg.sender === 'me' ? styles.outgoingMessage : styles.incomingMessage),
                  }}
                >
                  {msg.msg}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.chatInput}>
            <input
              type="text"
              value={inputValue}
              onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
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
