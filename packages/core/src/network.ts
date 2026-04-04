/* eslint-disable */
export interface Stream {
  source: AsyncIterable<Uint8Array>;
  sink: (source: AsyncIterable<Uint8Array>) => Promise<void>;
}

export interface NetworkAdapter {
  announce(key: string, value: Uint8Array, ttl: number): Promise<void>;
  query(key: string, count: number): Promise<Uint8Array[]>;
  dial(peerId: string, protocol: string): Promise<Stream>;

  publish?(topic: string, data: Uint8Array): Promise<void>;
  subscribe?(topic: string, handler: (data: Uint8Array) => void): void;
  unsubscribe?(topic: string): void;

  isRunning?(): boolean;

  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}
