/** IndexedDB key-value store for save slots (C23). One database, one object store. */

import type { KeyValueStore } from './slots';

const DB_NAME = 'zoravia';
const DB_VERSION = 1;
const STORE = 'saves';

export class IndexedDbStore implements KeyValueStore {
  private constructor(private readonly db: IDBDatabase) {}

  /** Opens (or creates) the save database. Rejects when IndexedDB is not available. */
  static open(name = DB_NAME): Promise<IndexedDbStore> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(new IndexedDbStore(req.result));
      req.onerror = () => reject(req.error ?? new Error('Could not open the save database'));
      req.onblocked = () => reject(new Error('The save database is blocked by another tab'));
    });
  }

  get(key: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = this.db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as unknown);
      req.onerror = () => reject(req.error ?? new Error(`Could not read "${key}"`));
    });
  }

  setMany(entries: readonly (readonly [string, unknown])[]): Promise<void> {
    return this.run((store) => {
      for (const [k, v] of entries) store.put(v, k);
    });
  }

  delete(keys: readonly string[]): Promise<void> {
    return this.run((store) => {
      for (const k of keys) store.delete(k);
    });
  }

  /** One read-write transaction; resolves when it commits. */
  private run(body: (store: IDBObjectStore) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Save failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Save was aborted'));
      body(tx.objectStore(STORE));
    });
  }
}
