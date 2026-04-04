/* eslint-disable */
import type { SlashingEvent } from '../types/stake.js';

export class SlashingHistory {
  private events: SlashingEvent[] = [];

  add(event: SlashingEvent): void {
    this.events.push(event);
  }

  getByPeer(peerID: string): SlashingEvent[] {
    return this.events.filter((event) => event.peerID === peerID);
  }

  getAll(): SlashingEvent[] {
    return [...this.events];
  }

  getTotalSlashed(peerID?: string): number {
    const relevantEvents = peerID ? this.getByPeer(peerID) : this.events;
    return relevantEvents.reduce((total, event) => total + event.amountSats, 0);
  }

  clear(): void {
    this.events = [];
  }

  import(data: SlashingEvent[]): void {
    this.events = [...data];
  }
}
