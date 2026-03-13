/**
 * Message Bubble Component
 */

import { h } from 'preact';
import type { ChatMessage } from '../../../chat/webrtc.js';
import { sanitizeMessage } from '../../../utils/sanitize.js';
import { getMessageStatusIcon, getMessageStatusColor } from '../utils/messageFormatter.js';
import '../styles/ChatsScreen.css';

interface MessageBubbleProps {
  message: ChatMessage;
  statusIcon?: string;
  statusColor?: string;
}

export function MessageBubble({ message, statusIcon, statusColor }: MessageBubbleProps) {
  const isOutgoing = message.sender === 'me';

  return (
    <div
      class={`message-bubble ${isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming'}`}
    >
      <span
        style={{ flex: 1 }}
        dangerouslySetInnerHTML={{ __html: sanitizeMessage(message.msg) }}
      />
      {statusIcon && (
        <span
          class="message-status-icon"
          style={{ color: statusColor }}
        >
          {statusIcon}
        </span>
      )}
    </div>
  );
}
