import type { ChatMessage, MessageStatus } from '../types/chat.js';

interface PendingMessage {
  message: ChatMessage;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: () => void;
  reject: (err: Error) => void;
  onStatusUpdate?: (messageId: number, status: MessageStatus) => void;
}

export class MessageQueue {
  private queue: Map<number, PendingMessage> = new Map();
  private nextMessageId = 1;

  add(
    message: ChatMessage,
    timeoutMs: number,
    resolve: () => void,
    onStatusUpdate?: (messageId: number, status: MessageStatus) => void
  ): number {
    const messageId = this.nextMessageId++;

    const timeoutId = setTimeout(() => {
      this.reject(messageId, new Error('Message timeout'), onStatusUpdate);
    }, timeoutMs);

    this.queue.set(messageId, {
      message,
      timeoutId,
      resolve,
      reject: () => {}, // Overridden later in send()
      onStatusUpdate,
    });

    return messageId;
  }

  get(messageId: number): PendingMessage | undefined {
    return this.queue.get(messageId);
  }

  resolve(messageId: number): void {
    const pending = this.queue.get(messageId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      if (pending.onStatusUpdate) {
        pending.onStatusUpdate(messageId, 'delivered');
      }
      pending.resolve();
      this.queue.delete(messageId);
    }
  }

  reject(
    messageId: number,
    err: Error,
    onStatusUpdate?: (messageId: number, status: MessageStatus) => void
  ): void {
    const pending = this.queue.get(messageId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      const notifyUpdate = onStatusUpdate || pending.onStatusUpdate;
      if (notifyUpdate) {
        notifyUpdate(messageId, 'failed');
      }
      pending.reject(err);
      this.queue.delete(messageId);
    }
  }

  clear(): void {
    for (const [, pending] of this.queue.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Queue cleared'));
    }
    this.queue.clear();
  }
}
