/**
 * IndexedDB Helper Functions
 * 
 * Provides async/await wrappers for IndexedDB operations.
 */

const DB_NAME = 'isc-social';
const DB_VERSION = 1;

interface DBStore {
  name: string;
  keyPath: string;
}

const STORES: DBStore[] = [
  { name: 'posts', keyPath: 'id' },
  { name: 'follows', keyPath: 'followee' },
  { name: 'likes', keyPath: 'id' },
  { name: 'reposts', keyPath: 'id' },
  { name: 'replies', keyPath: 'id' },
  { name: 'dms', keyPath: 'id' },
  { name: 'communities', keyPath: 'channelID' },
  { name: 'muted', keyPath: 'peerID' },
  { name: 'blocked', keyPath: 'peerID' },
];

let db: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      STORES.forEach((store) => {
        if (!database.objectStoreNames.contains(store.name)) {
          database.createObjectStore(store.name, { keyPath: store.keyPath });
        }
      });
    };
  });
}

export async function dbGet<T>(store: string, key: string): Promise<T | null> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, 'readonly');
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function dbPut<T>(
  store: string,
  value: T
): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, 'readwrite');
    const request = tx.objectStore(store).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbDelete(store: string, key: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, 'readwrite');
    const request = tx.objectStore(store).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbFilter<T>(
  store: string,
  predicate: (item: T) => boolean
): Promise<T[]> {
  const all = await dbGetAll<T>(store);
  return all.filter(predicate);
}

export async function dbClear(store: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, 'readwrite');
    const request = tx.objectStore(store).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function dbKeys(store: string): Promise<string[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, 'readonly');
    const request = tx.objectStore(store).getAllKeys();
    request.onsuccess = () => resolve(request.result as string[]);
    request.onerror = () => reject(request.error);
  });
}
