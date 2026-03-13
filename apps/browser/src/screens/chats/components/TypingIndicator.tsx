/**
 * Typing Indicator Component
 */

import { h } from 'preact';
import '../styles/ChatsScreen.css';

interface TypingIndicatorProps {
  isTyping: boolean;
}

export function TypingIndicator({ isTyping }: TypingIndicatorProps) {
  if (!isTyping) return null;

  return (
    <div class="message-bubble message-bubble-incoming typing-indicator">
      <span class="typing-dot">●</span>
      <span class="typing-dot">●</span>
      <span class="typing-dot">●</span>
    </div>
  );
}
