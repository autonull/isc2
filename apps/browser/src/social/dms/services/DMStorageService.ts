/**
 * DM Storage Service
 *
 * Handles database operations for direct messages.
 */

import { openDB, dbGet, dbGetAll, dbPut } from '@isc/adapters';
import type { DirectMessage, GroupDM } from '../types/dm.js';
import { DM_CONFIG, DM_STORES } from '../config/dmConfig.js';

let dmDb: IDBDatabase | null = null;

export class DMStorageService {
  /**
   * Get or create database connection
   */
  static async getDB(): Promise<IDBDatabase> {
    if (dmDb) return dmDb;

    dmDb = await openDB(DM_CONFIG.dbName, DM_CONFIG.dbVersion, (db) => {
      if (!db.objectStoreNames.contains(DM_STORES.DMS)) {
        db.createObjectStore(DM_STORES.DMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DM_STORES.GROUP_DMS)) {
        db.createObjectStore(DM_STORES.GROUP_DMS, { keyPath: 'groupID' });
      }
    });

    return dmDb;
  }

  /**
   * Store direct message
   */
  static async storeDM(dm: DirectMessage): Promise<void> {
    const db = await this.getDB();
    await dbPut(db, DM_STORES.DMS, dm);
  }

  /**
   * Store group DM
   */
  static async storeGroupDM(group: GroupDM): Promise<void> {
    const db = await this.getDB();
    await dbPut(db, DM_STORES.GROUP_DMS, group);
  }

  /**
   * Get DM by ID
   */
  static async getDM(dmID: string): Promise<DirectMessage | null> {
    const db = await this.getDB();
    return dbGet<DirectMessage>(db, DM_STORES.DMS, dmID);
  }

  /**
   * Get all DMs
   */
  static async getAllDMs(): Promise<DirectMessage[]> {
    const db = await this.getDB();
    return dbGetAll<DirectMessage>(db, DM_STORES.DMS);
  }

  /**
   * Get all group DMs
   */
  static async getAllGroupDMs(): Promise<GroupDM[]> {
    const db = await this.getDB();
    return dbGetAll<GroupDM>(db, DM_STORES.GROUP_DMS);
  }

  /**
   * Get group DM by ID
   */
  static async getGroupDM(groupID: string): Promise<GroupDM | null> {
    const db = await this.getDB();
    return dbGet<GroupDM>(db, DM_STORES.GROUP_DMS, groupID);
  }

  /**
   * Mark DM as read
   */
  static async markAsRead(dmID: string): Promise<void> {
    const db = await this.getDB();
    const dm = await this.getDM(dmID);
    if (dm) {
      dm.read = true;
      await dbPut(db, DM_STORES.DMS, dm);
    }
  }

  /**
   * Mark DMs from peer as read
   */
  static async markAllAsRead(peerID: string, myID: string): Promise<void> {
    const db = await this.getDB();
    const all = await this.getAllDMs();

    for (const dm of all) {
      if (dm.sender === peerID && dm.recipient === myID && !dm.read) {
        dm.read = true;
        await dbPut(db, DM_STORES.DMS, dm);
      }
    }
  }

  /**
   * Soft delete DM
   */
  static async deleteDM(dmID: string): Promise<void> {
    const db = await this.getDB();
    const dm = await this.getDM(dmID);
    if (dm) {
      await dbPut(db, DM_STORES.DMS, { ...dm, deleted: true });
    }
  }

  /**
   * Clear database connection (for testing)
   */
  static clearConnection(): void {
    dmDb = null;
  }
}
