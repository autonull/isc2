/* eslint-disable */
/**
 * Community Repository
 *
 * Implements repository pattern for IndexedDB operations.
 */

import { openDB, dbGet, dbGetAll, dbPut, dbDelete } from '@isc/adapters';
import { COMMUNITY_CONFIG, COMMUNITY_STORES } from '../config/communityConfig.ts';
import type { Community } from '../types/community.ts';

export class CommunityRepository {
  private db: IDBDatabase | null = null;

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(
      COMMUNITY_CONFIG.dbName,
      COMMUNITY_CONFIG.dbVersion,
      (database) => {
        if (!database.objectStoreNames.contains(COMMUNITY_STORES.COMMUNITIES)) {
          database.createObjectStore(COMMUNITY_STORES.COMMUNITIES, {
            keyPath: 'channelID',
          });
        }
      }
    );
  }

  /**
   * Get database instance
   */
  private getDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Get community by ID
   */
  async get(channelID: string): Promise<Community | null> {
    try {
      const db = this.getDB();
      return dbGet<Community>(db, COMMUNITY_STORES.COMMUNITIES, channelID);
    } catch {
      return null;
    }
  }

  /**
   * Store community
   */
  async save(community: Community): Promise<void> {
    const db = this.getDB();
    await dbPut(db, COMMUNITY_STORES.COMMUNITIES, community);
  }

  /**
   * Delete community
   */
  async delete(channelID: string): Promise<void> {
    const db = this.getDB();
    await dbDelete(db, COMMUNITY_STORES.COMMUNITIES, channelID);
  }

  /**
   * Get all communities
   */
  async getAll(): Promise<Community[]> {
    try {
      const db = this.getDB();
      return dbGetAll<Community>(db, COMMUNITY_STORES.COMMUNITIES);
    } catch {
      return [];
    }
  }

  /**
   * Filter communities by predicate
   */
  async filter(predicate: (community: Community) => boolean): Promise<Community[]> {
    const all = await this.getAll();
    return all.filter(predicate);
  }

  /**
   * Find communities where peer is a member
   */
  async findByMember(peerID: string): Promise<Community[]> {
    return this.filter((c) => c.members.includes(peerID));
  }

  /**
   * Find communities where peer is a co-editor
   */
  async findByCoEditor(peerID: string): Promise<Community[]> {
    return this.filter((c) => c.coEditors.includes(peerID));
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
