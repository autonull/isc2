/**
 * Hook for managing messages
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { ChatMessage, MessageStatus } from '../../../chat/webrtc.js';
import { MESSAGES_KEY_PREFIX } from '../types.js';

export function useMessages(peerId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageStatuses, setMessageStatuses] = useState<Map<number, MessageStatus>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(
    (id: string) => {
      try {
        const saved = localStorage.getItem(MESSAGES_KEY_PREFIX + id);
        if (saved) {
          const msgs: ChatMessage[] = JSON.parse(saved);
          setMessages(msgs);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('[useMessages] Failed to load messages:', err);
        setMessages([]);
      }
    },
    []
  );

  const saveMessages = useCallback((id: string, msgs: ChatMessage[]) => {
    try {
      localStorage.setItem(MESSAGES_KEY_PREFIX + id, JSON.stringify(msgs));
    } catch (err) {
      console.error('[useMessages] Failed to save messages:', err);
    }
  }, []);

  const addMessage = useCallback(
    (msg: ChatMessage) => {
      setMessages(prev => {
        const updated = [...prev, msg];
        if (peerId) {
          saveMessages(peerId, updated);
        }
        return updated;
      });
    },
    [peerId, saveMessages]
  );

  const updateMessageStatus = useCallback((messageId: number, status: MessageStatus) => {
    setMessageStatuses(prev => {
      const updated = new Map(prev);
      updated.set(messageId, status);
      return updated;
    });
    if (peerId) {
      setMessages(prev => {
        const updated = prev.map(m => (m.id === String(messageId) ? { ...m, status } : m));
        saveMessages(peerId, updated);
        return updated;
      });
    }
  }, [peerId, saveMessages]);

  useEffect(() => {
    if (peerId) {
      loadMessages(peerId);
    }
  }, [peerId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return {
    messages,
    messageStatuses,
    messagesEndRef,
    loadMessages,
    saveMessages,
    addMessage,
    updateMessageStatus,
  };
}
