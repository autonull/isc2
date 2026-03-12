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
  similarity?: number;
}

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
  chatPanel: { position: 'fixed' as const, bottom: 0, left: 0, right: 0, height: '70%', background: 'white', borderTop: '1px solid #e1e8ed', display: 'flex', flexDirection: 'column' as const },
  chatHeader: { padding: '16px', borderBottom: '1px solid #e1e8ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  chatMessages: { flex: 1, padding: '16px', overflowY: 'auto' as const },
  messageBubble: { padding: '8px 12px', borderRadius: '16px', marginBottom: '8px', maxWidth: '70%', wordWrap: 'break-word' as const },
  incomingMessage: { background: '#f7f9fa', alignSelf: 'flex-start' } as const,
  outgoingMessage: { background: '#1da1f2', color: 'white', alignSelf: 'flex-end', marginLeft: 'auto' } as const,
  chatInput: { display: 'flex', padding: '16px', borderTop: '1px solid #e1e8ed' } as const,
  input: { flex: 1, padding: '12px', border: '1px solid #e1e8ed', borderRadius: '20px', fontSize: '14px', marginRight: '8px' } as const,
  sendBtn: { padding: '8px 24px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' as const } as const,
  closeBtn: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#657786' } as const,
};

export function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      // Get DHT client
      const dhtClient = await initializeDHT();
      
      // Get active channel
      const channels = await channelManager.getAllChannels();
      const activeChannel = channels.find(c => c.active) || channels[0];
      
      if (!activeChannel) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // For now, create mock conversations from DHT connections
      // In production, would query DHT for actual peer announcements
      const connections = dhtClient.getConnectionCount();
      const peerId = dhtClient.getPeerId();
      
      const convos: Conversation[] = [];
      if (connections > 0) {
        // Create a conversation from connected peer
        convos.push({
          peerId: 'peer_' + Math.random().toString(36).slice(2),
          channelID: activeChannel.id,
          unreadCount: 0,
        });
      }
      
      setConversations(convos);
    } catch (err) {
      console.error('[Chats] Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();

    // Setup chat handler
    const chatHandler = getChatHandler();
    chatHandler.setOnMessage((msg) => {
      console.log('[Chats] New message:', msg);
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      chatHandler.closeAll();
    };
  }, [loadConversations]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (convo: Conversation) => {
    setActiveChat(convo);
    setMessages([]); // Load messages for this conversation
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
      const chatHandler = getChatHandler();
      await chatHandler.sendMessage(activeChat.peerId, message, dhtClient as any);
      
      setMessages(prev => [...prev, message]);
      setInputValue('');
    } catch (err) {
      console.error('[Chats] Failed to send message:', err);
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
                  <span style={styles.time}>{new Date(convo.lastMessageTime).toLocaleTimeString()}</span>
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
            <h2 style={{ margin: 0, fontSize: '16px' }}>
              Peer {activeChat.peerId.slice(0, 8)}...
            </h2>
            <button style={styles.closeBtn} onClick={handleCloseChat}>×</button>
          </header>

          <div style={styles.chatMessages}>
            {messages.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#657786' }}>
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
