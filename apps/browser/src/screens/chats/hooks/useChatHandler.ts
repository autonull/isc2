/**
 * Hook for setting up chat handler
 */

import { useEffect, useCallback } from 'preact/hooks';
import { getDHTClient, initializeDHT } from '../../../network/dht.js';
import { getChatHandler, type ChatMessage, type MessageStatus, type TypingIndicator } from '../../../chat/webrtc.js';

interface ChatHandlerCallbacks {
  onMessage?: (msg: ChatMessage) => void;
  onStatusUpdate?: (messageId: number, status: MessageStatus) => void;
  onTyping?: (indicator: TypingIndicator) => void;
}

export function useChatHandler(callbacks: ChatHandlerCallbacks, activeChatPeerId?: string | null) {
  const setupChatHandler = useCallback(async () => {
    const chatHandler = getChatHandler();

    if (callbacks.onMessage) {
      chatHandler.setOnMessage(callbacks.onMessage);
    }

    if (callbacks.onStatusUpdate) {
      chatHandler.setOnStatusUpdate(callbacks.onStatusUpdate);
    }

    if (callbacks.onTyping) {
      chatHandler.setOnTyping(callbacks.onTyping);
    }

    const dhtClient = await initializeDHT();
    const node = dhtClient.getNode();
    if (node && !chatHandler['registeredNode']) {
      chatHandler.registerWithNode(node);
    }
  }, [callbacks.onMessage, callbacks.onStatusUpdate, callbacks.onTyping]);

  useEffect(() => {
    setupChatHandler();
  }, [setupChatHandler]);

  const sendMessage = useCallback(
    async (peerId: string, message: ChatMessage) => {
      const dhtClient = getDHTClient();
      const node = dhtClient.getNode();
      const chatHandler = getChatHandler();

      if (!node) {
        throw new Error('Not connected to network');
      }

      await chatHandler.sendMessage(peerId, message, node);
    },
    []
  );

  const sendTypingIndicator = useCallback(
    (peerId: string, channelID: string) => {
      const dhtClient = getDHTClient();
      const node = dhtClient.getNode();
      if (node) {
        const chatHandler = getChatHandler();
        chatHandler.sendTypingIndicator(peerId, channelID, node);
      }
    },
    []
  );

  return {
    sendMessage,
    sendTypingIndicator,
  };
}
