/**
 * Chats Screen - Real WebRTC Conversations
 *
 * No mocks - actual P2P chat via libp2p
 */

import { h } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import type { ChatMessage, MessageStatus } from '../chat/webrtc.js';
import { getChatHandler } from '../chat/webrtc.js';
import { notificationService } from '../chat/notifications.js';
import { SkeletonConversation } from '../components/Skeleton.js';
import { useConversations } from './chats/hooks/useConversations.js';
import { useMessages } from './chats/hooks/useMessages.js';
import { useTypingIndicator } from './chats/hooks/useTypingIndicator.js';
import { useChatHandler } from './chats/hooks/useChatHandler.js';
import { ConversationList } from './chats/components/ConversationList.js';
import { ChatPanel } from './chats/components/ChatPanel.js';
import type { Conversation } from './chats/types.js';
import { loggers } from '../utils/logger.js';
import './chats/styles/ChatsScreen.css';

const logger = loggers.chat;

export function ChatsScreen() {
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [inputValue, setInputValue] = useState('');

  const {
    conversations,
    loading,
    clearUnread,
    updateLastMessage,
  } = useConversations(activeChat?.peerId);

  const {
    messages,
    messageStatuses,
    addMessage,
    updateMessageStatus,
    saveMessages,
  } = useMessages(activeChat?.peerId || null);

  const { typingPeer, handleTyping } = useTypingIndicator(activeChat?.peerId);

  const handleNewMessage = useCallback(
    (msg: ChatMessage) => {
      if (msg.sender !== 'me') {
        notificationService.showMessage(msg.sender, msg.msg);
        
        // Update unread count and badge if chat is not active
        if (!activeChat || msg.sender !== activeChat.peerId) {
          const peerId = msg.sender;
          // Increment unread count for this conversation
          const saved = localStorage.getItem('isc-conversations');
          if (saved) {
            const convos: Conversation[] = JSON.parse(saved);
            const convo = convos.find(c => c.peerId === peerId);
            if (convo) {
              convo.unreadCount = (convo.unreadCount || 0) + 1;
              localStorage.setItem('isc-conversations', JSON.stringify(convos));
              const totalUnread = convos.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
              notificationService.setBadgeCount(totalUnread);
            }
          }
        }
      }

      addMessage(msg);

      const peerId = msg.sender === 'me' ? activeChat?.peerId || 'unknown' : msg.sender;
      updateLastMessage(peerId, msg.msg, msg.timestamp);
    },
    [activeChat?.peerId, addMessage, updateLastMessage]
  );

  const handleStatusUpdate = useCallback(
    (messageId: number, status: MessageStatus) => {
      logger.debug('Message status update', { messageId: String(messageId), status });
      updateMessageStatus(messageId, status);
    },
    [updateMessageStatus]
  );

  const { sendMessage, sendTypingIndicator } = useChatHandler(
    {
      onMessage: handleNewMessage,
      onStatusUpdate: handleStatusUpdate,
      onTyping: handleTyping,
    },
    activeChat?.peerId
  );

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('isc-messages-') && e.newValue && activeChat) {
        const msgs: ChatMessage[] = JSON.parse(e.newValue);
        addMessage(msgs[msgs.length - 1]);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [activeChat, addMessage]);

  const handleSelectConversation = (convo: Conversation) => {
    clearUnread(convo.peerId);
    setActiveChat(convo);
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
      await sendMessage(activeChat.peerId, message);
      updateLastMessage(activeChat.peerId, message.msg, message.timestamp);
      setInputValue('');
    } catch (err) {
      logger.error('Failed to send message', err as Error);
      alert('Failed to send message: ' + (err as Error).message);
    }
  };

  const handleSendTyping = () => {
    if (activeChat) {
      sendTypingIndicator(activeChat.peerId, activeChat.channelID);
    }
  };

  if (loading) {
    return (
      <div class="chats-screen">
        <header class="chats-header">
          <h1 class="chats-title">Chats</h1>
        </header>
        <div class="chats-content">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonConversation key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div class="chats-screen">
      <header class="chats-header">
        <h1 class="chats-title">Chats</h1>
      </header>

      <div class="chats-content">
        <ConversationList
          conversations={conversations}
          onSelect={handleSelectConversation}
        />
      </div>

      {activeChat && (
        <ChatPanel
          activeChat={activeChat}
          messages={messages}
          messageStatuses={messageStatuses}
          typingPeer={typingPeer}
          onClose={handleCloseChat}
          onSendMessage={handleSendMessage}
          onSendTyping={handleSendTyping}
        />
      )}
    </div>
  );
}
