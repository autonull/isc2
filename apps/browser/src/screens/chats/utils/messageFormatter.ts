/**
 * Message formatting utilities
 */

import type { MessageStatus } from '../../../chat/webrtc.js';

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function getMessageStatusIcon(status?: MessageStatus): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'sent':
      return '✓';
    case 'delivered':
      return '✓✓';
    case 'failed':
      return '⚠️';
    default:
      return '';
  }
}

export function getMessageStatusColor(status?: MessageStatus): string {
  switch (status) {
    case 'pending':
      return '#657786';
    case 'sent':
      return '#657786';
    case 'delivered':
      return '#17bf63';
    case 'failed':
      return '#e0245e';
    default:
      return '#657786';
  }
}
