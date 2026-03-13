import type { WithdrawalRequest } from '../types/stake.js';

export class WithdrawalQueue {
  private queue: Map<string, WithdrawalRequest> = new Map();

  get pendingCount(): number {
    let count = 0;
    for (const request of this.queue.values()) {
      if (request.status === 'pending') {
        count++;
      }
    }
    return count;
  }

  add(request: WithdrawalRequest): void {
    this.queue.set(request.peerID, request);
  }

  get(requestKey: string): WithdrawalRequest | undefined {
    return this.queue.get(requestKey);
  }

  updateStatus(requestKey: string, status: WithdrawalRequest['status']): void {
    const request = this.queue.get(requestKey);
    if (request) {
      request.status = status;
    }
  }

  clear(): void {
    this.queue.clear();
  }

  export(): Map<string, WithdrawalRequest> {
    return new Map(this.queue);
  }

  import(data: Map<string, WithdrawalRequest>): void {
    this.queue = new Map(data);
  }
}
