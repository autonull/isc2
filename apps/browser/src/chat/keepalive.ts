export interface KeepaliveConfig {
  pingIntervalMs?: number;
  timeoutMs?: number;
  onTimeout?: (peerId: string) => void;
  onPing?: (peerId: string) => void;
}

export class ChatKeepalive {
  private pingIntervalMs: number;
  private timeoutMs: number;
  private onTimeout?: (peerId: string) => void;
  private onPing?: (peerId: string) => void;

  private pingTimers = new Map<string, number>();
  private pongTimers = new Map<string, number>();
  private running = false;

  constructor(config: KeepaliveConfig) {
    this.pingIntervalMs = config.pingIntervalMs ?? 30000;
    this.timeoutMs = config.timeoutMs ?? 90000;
    this.onTimeout = config.onTimeout;
    this.onPing = config.onPing;
  }

  start(peerId: string): void {
    this.stop(peerId);

    const pingTimer = window.setInterval(() => {
      if (!this.running) return;
      this.onPing?.(peerId);
      this.schedulePong(peerId);
    }, this.pingIntervalMs);

    this.pingTimers.set(peerId, pingTimer);
  }

  private schedulePong(peerId: string): void {
    const existing = this.pongTimers.get(peerId);
    if (existing) clearTimeout(existing);

    const pongTimer = window.setTimeout(() => {
      this.onTimeout?.(peerId);
      this.stop(peerId);
    }, this.timeoutMs);

    this.pongTimers.set(peerId, pongTimer);
  }

  receivedPong(peerId: string): void {
    const timer = this.pongTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.pongTimers.delete(peerId);
    }
  }

  stop(peerId: string): void {
    const pingTimer = this.pingTimers.get(peerId);
    if (pingTimer) {
      clearInterval(pingTimer);
      this.pingTimers.delete(peerId);
    }

    const pongTimer = this.pongTimers.get(peerId);
    if (pongTimer) {
      clearTimeout(pongTimer);
      this.pongTimers.delete(peerId);
    }
  }

  stopAll(): void {
    this.running = false;
    for (const peerId of this.pingTimers.keys()) {
      this.stop(peerId);
    }
  }

  startAll(peerIds: string[]): void {
    this.running = true;
    for (const peerId of peerIds) {
      this.start(peerId);
    }
  }
}
