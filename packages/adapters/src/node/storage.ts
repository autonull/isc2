import type { StorageAdapter } from '../interfaces/storage.js';

interface LevelDBOptions {
  dbPath?: string;
}

export class NodeStorage implements StorageAdapter {
  private db: any = null;

  constructor(private options: Required<LevelDBOptions> = { dbPath: './isc-db' }) {}

  async init(): Promise<void> {
    if (this.db) return;
    const { Level } = await import('level');
    this.db = new Level(this.options.dbPath, { valueEncoding: 'json' });
    await this.db.open();
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();
    try {
      const value = await this.db.get(key);
      return value as T;
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') return null;
      throw error;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.init();
    await this.db.put(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.init();
    try {
      await this.db.del(key);
    } catch (error) {
      if ((error as any).code !== 'LEVEL_NOT_FOUND') throw error;
    }
  }

  async *keys(prefix?: string): AsyncIterable<string> {
    await this.init();

    const stream = this.db.createReadStream({
      gte: prefix ?? '',
      lte: prefix ? `${prefix}\ufff0` : undefined,
    });

    for await (const entry of stream) {
      yield entry.key as string;
    }
  }

  async clear(): Promise<void> {
    await this.init();
    await this.db.clear();
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

export const nodeStorage = new NodeStorage();
