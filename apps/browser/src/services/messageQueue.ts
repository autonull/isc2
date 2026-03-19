/**
 * Message Queue Service
 *
 * Queues messages received while tab was hidden/backgrounded.
 * Delivers messages on next focus.
 */

interface QueuedMessage {
  id: string;
  topic: string;
  data: any;
  timestamp: number;
  delivered: boolean;
}

const QUEUE_KEY = 'isc:message-queue';
const MAX_QUEUE_SIZE = 100;
const MESSAGE_TTL = 3600000; // 1 hour

export class MessageQueueService {
  private queue: QueuedMessage[] = [];
  private listeners: Set<(msg: QueuedMessage) => void> = new Set();

  constructor() {
    this.loadQueue();
    this.setupVisibilityHandler();
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Filter out expired messages
        const now = Date.now();
        this.queue = this.queue.filter(
          (msg) => now - msg.timestamp < MESSAGE_TTL
        );
        this.saveQueue();
      }
    } catch (err) {
      console.warn('[MessageQueue] Failed to load queue:', err);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.warn('[MessageQueue] Failed to save queue:', err);
    }
  }

  private setupVisibilityHandler() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.deliverQueuedMessages();
      }
    });

    window.addEventListener('focus', () => {
      this.deliverQueuedMessages();
    });
  }

  /**
   * Add message to queue (called when tab is hidden)
   */
  enqueue(topic: string, data: any): string {
    const message: QueuedMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      topic,
      data,
      timestamp: Date.now(),
      delivered: false,
    };

    this.queue.push(message);

    // Limit queue size
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    this.saveQueue();
    console.log('[MessageQueue] Enqueued message:', message.id);

    return message.id;
  }

  /**
   * Deliver all queued messages (called when tab becomes visible)
   */
  deliverQueuedMessages(): QueuedMessage[] {
    const now = Date.now();
    const undelivered = this.queue.filter(
      (msg) => !msg.delivered && now - msg.timestamp < MESSAGE_TTL
    );

    if (undelivered.length === 0) return [];

    console.log('[MessageQueue] Delivering', undelivered.length, 'queued messages');

    undelivered.forEach((msg) => {
      msg.delivered = true;
      this.listeners.forEach((listener) => listener(msg));
    });

    // Cleanup delivered messages after delay
    setTimeout(() => {
      this.queue = this.queue.filter((msg) => !msg.delivered);
      this.saveQueue();
    }, 5000);

    return undelivered;
  }

  /**
   * Subscribe to queued message delivery
   */
  onMessage(callback: (msg: QueuedMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get queue statistics
   */
  getStats(): { size: number; undelivered: number } {
    const now = Date.now();
    const undelivered = this.queue.filter(
      (msg) => !msg.delivered && now - msg.timestamp < MESSAGE_TTL
    ).length;

    return {
      size: this.queue.length,
      undelivered,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Get all pending messages for a topic
   */
  getPending(topic: string): QueuedMessage[] {
    const now = Date.now();
    return this.queue.filter(
      (msg) =>
        msg.topic === topic &&
        !msg.delivered &&
        now - msg.timestamp < MESSAGE_TTL
    );
  }
}

// Singleton instance
let _instance: MessageQueueService | null = null;

export function getMessageQueue(): MessageQueueService {
  if (!_instance) {
    _instance = new MessageQueueService();
  }
  return _instance;
}
