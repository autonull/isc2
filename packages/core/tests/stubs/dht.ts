/* eslint-disable */
export interface DHTEntry {
  value: Uint8Array;
  expiresAt: number;
}

export interface DHTQueryResult {
  value: Uint8Array;
  expiresAt: number;
}

export class InMemoryDHT {
  private store = new Map<string, DHTEntry[]>();
  private ttl: number;

  constructor(defaultTTL: number = 300000) {
    this.ttl = defaultTTL;
  }

  async put(key: string, value: Uint8Array, ttl?: number): Promise<void> {
    const expiry = Date.now() + (ttl ?? this.ttl);
    const existing = this.store.get(key) ?? [];
    existing.push({ value: value.slice(), expiresAt: expiry });
    this.store.set(key, existing);
    this.cleanupExpired(key);
  }

  async get(key: string): Promise<Uint8Array | null> {
    this.cleanupExpired(key);
    const entries = this.store.get(key);
    if (!entries || entries.length === 0) return null;
    return entries[0].value;
  }

  async getMany(keyPrefix: string, count: number): Promise<Uint8Array[]> {
    this.cleanupExpiredPrefix(keyPrefix);
    const results: Uint8Array[] = [];
    for (const [key, entries] of this.store) {
      if (key.startsWith(keyPrefix)) {
        for (const entry of entries) {
          if (results.length >= count) break;
          results.push(entry.value);
        }
      }
      if (results.length >= count) break;
    }
    return results;
  }

  async getWithCursor(
    keyPrefix: string,
    count: number,
    _cursor?: string
  ): Promise<{ values: Uint8Array[]; cursor?: string }> {
    const values = await this.getMany(keyPrefix, count);
    const cursor = values.length === count ? `cursor_${Date.now()}` : undefined;
    return { values, cursor };
  }

  private cleanupExpired(key: string): void {
    const entries = this.store.get(key);
    if (!entries) return;
    const now = Date.now();
    const valid = entries.filter((e) => e.expiresAt > now);
    if (valid.length === 0) {
      this.store.delete(key);
    } else {
      this.store.set(key, valid);
    }
  }

  private cleanupExpiredPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.cleanupExpired(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    let count = 0;
    for (const entries of this.store.values()) {
      count += entries.length;
    }
    return count;
  }
}
