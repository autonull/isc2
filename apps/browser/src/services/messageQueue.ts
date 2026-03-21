interface QueuedMessage {
  id: string;
  topic: string;
  data: unknown;
  timestamp: number;
  delivered: boolean;
}

const QUEUE_KEY = 'isc:message-queue';
const MAX_QUEUE_SIZE = 100;
const MESSAGE_TTL = 3600000;

export class MessageQueueService {
  private queue: QueuedMessage[] = [];
  private listeners = new Set<(msg: QueuedMessage) => void>();

  constructor() {
    this.loadQueue();
    this.setupVisibilityHandler();
  }

  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        const now = Date.now();
        this.queue = JSON.parse(stored).filter(
          (msg: QueuedMessage) => now - msg.timestamp < MESSAGE_TTL
        );
        this.saveQueue();
      }
    } catch (err) {
      console.warn('[MessageQueue] Failed to load queue:', err);
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.warn('[MessageQueue] Failed to save queue:', err);
    }
  }

  private setupVisibilityHandler(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.deliverQueuedMessages();
    });
    window.addEventListener('focus', () => this.deliverQueuedMessages());
  }

  enqueue(topic: string, data: unknown): string {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const message: QueuedMessage = { id, topic, data, timestamp: Date.now(), delivered: false };
    this.queue.push(message);
    if (this.queue.length > MAX_QUEUE_SIZE) this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    this.saveQueue();
    return message.id;
  }

  deliverQueuedMessages(): QueuedMessage[] {
    const now = Date.now();
    const undelivered = this.queue.filter(
      (msg) => !msg.delivered && now - msg.timestamp < MESSAGE_TTL
    );
    if (undelivered.length === 0) return [];

    undelivered.forEach((msg) => {
      msg.delivered = true;
      this.listeners.forEach((listener) => listener(msg));
    });
    setTimeout(() => {
      this.queue = this.queue.filter((msg) => !msg.delivered);
      this.saveQueue();
    }, 5000);
    return undelivered;
  }

  onMessage(callback: (msg: QueuedMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getStats() {
    const now = Date.now();
    const undelivered = this.queue.filter(
      (msg) => !msg.delivered && now - msg.timestamp < MESSAGE_TTL
    ).length;
    return { size: this.queue.length, undelivered };
  }

  clear(): void {
    this.queue = [];
    this.saveQueue();
  }

  getPending(topic: string): QueuedMessage[] {
    const now = Date.now();
    return this.queue.filter(
      (msg) => msg.topic === topic && !msg.delivered && now - msg.timestamp < MESSAGE_TTL
    );
  }
}

let _instance: MessageQueueService | null = null;

export function getMessageQueue(): MessageQueueService {
  if (!_instance) _instance = new MessageQueueService();
  return _instance;
}
