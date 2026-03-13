/**
 * Hook for managing typing indicators
 */

import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { TypingIndicator } from '../../../chat/webrtc.js';

export function useTypingIndicator(activeChatPeerId?: string | null) {
  const [typingPeer, setTypingPeer] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleTyping = useCallback(
    (indicator: TypingIndicator) => {
      if (!activeChatPeerId) return;

      if (indicator.timestamp === 0 || indicator.sender !== activeChatPeerId) {
        setTypingPeer(null);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      } else {
        setTypingPeer(indicator.sender);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          setTypingPeer(null);
        }, 3000);
      }
    },
    [activeChatPeerId]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    typingPeer,
    handleTyping,
  };
}
