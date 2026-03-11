/**
 * Test Setup File
 *
 * Configures test environment and global mocks.
 */

// In-memory storage for IndexedDB
const idbStores = new Map<string, Map<string, any>>();

// Mock IndexedDB
class MockIDBDatabase {
  private _objectStoreNames = new Set<string>();
  transaction = vi.fn((storeName: string, mode: string) => {
    const store = this.getObjectStore(storeName);
    return {
      objectStore: vi.fn(() => store),
      oncomplete: null,
      onerror: null,
      onabort: null,
    };
  });
  objectStoreNames = {
    contains: (name: string) => this._objectStoreNames.has(name),
    item: (index: number) => Array.from(this._objectStoreNames)[index] || null,
    get length() { return this._objectStoreNames.size; },
  };
  name = 'mock-db';
  version = 1;

  createObjectStore = vi.fn((name: string) => {
    this._objectStoreNames.add(name);
    if (!idbStores.has(name)) {
      idbStores.set(name, new Map());
    }
    return this.getObjectStore(name);
  });
  deleteObjectStore = vi.fn((name: string) => {
    this._objectStoreNames.delete(name);
    idbStores.delete(name);
  });
  close = vi.fn();

  private getObjectStore(name: string) {
    if (!idbStores.has(name)) {
      idbStores.set(name, new Map());
    }
    const data = idbStores.get(name)!;
    return new MockIDBObjectStore(data);
  }
}

class MockIDBRequest {
  result: any = null;
  error: Error | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  source: any = null;
  transaction: any = null;
  readyState: 'pending' | 'done' = 'done';

  constructor(result?: any) {
    this.result = result;
    // Trigger onsuccess immediately for synchronous tests
    setTimeout(() => {
      if (this.onsuccess) this.onsuccess();
    }, 0);
  }

  // Make the request thenable so it can be awaited
  then(resolve: (value: any) => void, reject: (reason?: any) => void) {
    return Promise.resolve(this.result).then(resolve, reject);
  }
}

class MockIDBObjectStore {
  data: Map<any, any>;

  constructor(data: Map<any, any>) {
    this.data = data;
  }

  get = vi.fn((key) => {
    const result = this.data.get(key);
    return new MockIDBRequest(result);
  });

  getAll = vi.fn(() => {
    const result = Array.from(this.data.values());
    return new MockIDBRequest(result);
  });

  put = vi.fn((item) => {
    const key = item.id || item.peerID || item.followee || item.postId || item.groupID || item.reportId || 'default';
    this.data.set(key, item);
    return new MockIDBRequest(key);
  });

  delete = vi.fn((key) => {
    this.data.delete(key);
    return new MockIDBRequest(undefined);
  });

  add = vi.fn((item) => {
    const key = item.id || 'default';
    this.data.set(key, item);
    return new MockIDBRequest(key);
  });

  clear = vi.fn(() => {
    this.data.clear();
    return new MockIDBRequest(undefined);
  });

  openCursor = vi.fn(() => {
    const values = Array.from(this.data.values());
    return new MockIDBRequest(values.length > 0 ? { value: values[0], key: values[0].id } : null);
  });
}

class MockIDBTransaction {
  objectStore = vi.fn();
  oncomplete = null;
  onerror = null;
  onabort = null;
  mode = 'readwrite';
  objectStoreNames = new Set<string>();
}

// Global mock for indexedDB
const mockIndexedDB = {
  open: vi.fn((name: string, version?: number) => {
    const db = new MockIDBDatabase();
    const request = new MockIDBRequest(db);
    (request as any).result = db;

    // Pre-create common stores
    const commonStores = ['posts', 'likes', 'reposts', 'replies', 'quotes', 'follows', 'mutes', 'blocks',
      'reports', 'votes', 'councils', 'decisions', 'dms', 'group_dms', 'communities', 'views',
      'impressions', 'analytics'];

    commonStores.forEach(store => {
      (db as any)._objectStoreNames.add(store);
      if (!idbStores.has(store)) {
        idbStores.set(store, new Map());
      }
    });

    // Trigger upgrade needed for store creation
    setTimeout(() => {
      if ((request as any).onupgradeneeded) {
        (request as any).onupgradeneeded({ target: request } as any);
      }
      if (request.onsuccess) {
        request.onsuccess();
      }
    }, 0);

    return request;
  }),
};

// Set up global mocks
(global as any).indexedDB = mockIndexedDB;
(global as any).IDBDatabase = MockIDBDatabase;
(global as any).IDBRequest = MockIDBRequest;
(global as any).IDBObjectStore = MockIDBObjectStore;
(global as any).IDBTransaction = MockIDBTransaction;
(global as any).IDBKeyRange = {
  only: vi.fn((value) => ({ type: 'only', value })),
  lowerBound: vi.fn((value) => ({ type: 'lower', value })),
  upperBound: vi.fn((value) => ({ type: 'upper', value })),
  bound: vi.fn((lower, upper) => ({ type: 'bound', lower, upper })),
};

// Mock crypto using Object.defineProperty to override getter
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: vi.fn(<T extends Uint8Array>(array: T) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
    randomUUID: vi.fn(() => `test-uuid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    subtle: {
      generateKey: vi.fn().mockResolvedValue({
        publicKey: {},
        privateKey: {},
      }),
      sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      verify: vi.fn().mockResolvedValue(true),
      encrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      decrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      importKey: vi.fn().mockResolvedValue({}),
      exportKey: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      deriveKey: vi.fn().mockResolvedValue({}),
    },
  },
  writable: true,
  configurable: true,
});
