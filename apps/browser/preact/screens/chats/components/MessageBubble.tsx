/**
 * Message Bubble Component
 * 
 * Displays a chat message with delivery status indicators.
 */

import { h } from 'preact';
import type { ChatMessage, MessageStatus } from '../../../chat/webrtc.js';
import { sanitizeMessage } from '../../../utils/sanitize.js';
import { getMessageStatusIcon, getMessageStatusColor, getMessageStatusText } from '../utils/messageFormatter.js';
import '../styles/ChatsScreen.css';

interface MessageBubbleProps {
  message: ChatMessage;
  statusIcon?: string;
  statusColor?: string;
  showTimestamp?: boolean;
}

export function MessageBubble({ message, statusIcon, statusColor, showTimestamp = true }: MessageBubbleProps) {
  const isOutgoing = message.sender === 'me';
  const status = message.status || (isOutgoing ? 'sent' : undefined);
  const statusText = getMessageStatusText(status);

  return (
    <div
      class={`message-bubble ${isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming'}`}
      title={statusText}
    >
      <div class="message-content">
        <span
          style={{ flex: 1 }}
          dangerouslySetInnerHTML={{ __html: sanitizeMessage(message.msg) }}
        />
      </div>
      
      <div class="message-meta">
        {showTimestamp && (
          <span class="message-timestamp">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        
        {isOutgoing && statusIcon && (
          <span
            class={`message-status-icon message-status-${status}`}
            style={{ color: statusColor }}
            title={statusText}
          >
            {statusIcon}
          </span>
        )}
      </div>
    </div>
  );
}
