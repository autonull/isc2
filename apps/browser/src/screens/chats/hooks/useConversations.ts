/**
 * Hook for managing conversations
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { notificationService } from '../../../chat/notifications.js';
import type { Conversation } from '../types.js';
import { CONVERSATIONS_KEY } from '../types.js';

export function useConversations(activeChatPeerId?: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(() => {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_KEY);
      if (saved) {
        const convos: Conversation[] = JSON.parse(saved);
        const sorted = convos.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        setConversations(sorted);
        
        // Update badge count on load
        const totalUnread = sorted.reduce((sum, c) => sum + c.unreadCount, 0);
        notificationService.setBadgeCount(totalUnread);
      }
    } catch (err) {
      console.error('[useConversations] Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUnreadCount = useCallback((peerId: string, unreadCount: number) => {
    setConversations(prev => {
      const updated = prev.map(c =>
        c.peerId === peerId ? { ...c, unreadCount } : c
      );
      const totalUnread = updated.reduce((sum, c) => sum + c.unreadCount, 0);
      notificationService.setBadgeCount(totalUnread);
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
      return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    });
  }, []);

  const clearUnread = useCallback((peerId: string) => {
    setConversations(prev => {
      const updated = prev.map(c =>
        c.peerId === peerId ? { ...c, unreadCount: 0 } : c
      );
      const totalUnread = updated.reduce((sum, c) => sum + c.unreadCount, 0);
      notificationService.setBadgeCount(totalUnread);
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateLastMessage = useCallback((peerId: string, message: string, timestamp: number) => {
    setConversations(prev => {
      const updated = prev.map(c =>
        c.peerId === peerId
          ? { ...c, lastMessage: message, lastMessageTime: timestamp }
          : c
      );
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
      return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    });
  }, []);

  useEffect(() => {
    loadConversations();
    notificationService.requestPermission();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CONVERSATIONS_KEY && e.newValue) {
        const convos: Conversation[] = JSON.parse(e.newValue);
        setConversations(convos.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)));
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadConversations]);

  return {
    conversations,
    loading,
    loadConversations,
    updateUnreadCount,
    clearUnread,
    updateLastMessage,
  };
}
