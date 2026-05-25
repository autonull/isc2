/* eslint-disable */
import type { NetworkAdapter as CoreNetworkAdapter } from '@isc/core';

export interface Stream {
  source: AsyncIterable<Uint8Array>;
  sink: (source: AsyncIterable<Uint8Array>) => Promise<void>;
}

export interface NetworkAdapter extends CoreNetworkAdapter {
  announce(key: string, value: Uint8Array, ttl: number): Promise<void>;
  query(key: string, count: number): Promise<Uint8Array[]>;
  dial(peerId: string, protocol: string): Promise<Stream>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}
