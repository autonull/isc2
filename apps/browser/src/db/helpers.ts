import { openDB, dbGet as _dbGet, dbGetAll as _dbGetAll, dbPut as _dbPut, dbDelete as _dbDelete, dbClear as _dbClear, dbKeys as _dbKeys, dbFilter as _dbFilter } from '@isc/adapters';

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

  db = await openDB(DB_NAME, DB_VERSION, (database, _event) => {
    STORES.forEach((store) => {
      if (!database.objectStoreNames.contains(store.name)) {
        database.createObjectStore(store.name, { keyPath: store.keyPath });
      }
    });
  });

  return db;
}

// Wrapper functions to maintain backward-compatible signatures
export async function dbGet<T>(store: string, key: string): Promise<T | null> {
  const database = await getDB();
  return _dbGet<T>(database, store, key);
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  const database = await getDB();
  return _dbGetAll<T>(database, store);
}

export async function dbPut<T>(store: string, value: T): Promise<void> {
  const database = await getDB();
  return _dbPut<T>(database, store, value);
}

export async function dbDelete(store: string, key: string): Promise<void> {
  const database = await getDB();
  return _dbDelete(database, store, key);
}

export async function dbClear(store: string): Promise<void> {
  const database = await getDB();
  return _dbClear(database, store);
}

export async function dbKeys(store: string): Promise<string[]> {
  const database = await getDB();
  return _dbKeys(database, store);
}

export async function dbFilter<T>(store: string, predicate: (item: T) => boolean): Promise<T[]> {
  const database = await getDB();
  return _dbFilter<T>(database, store, predicate);
}
