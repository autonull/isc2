/**
 * Direct Messages Service
 *
 * Handles E2E encrypted 1:1 and group messaging.
 * References: SOCIAL.md#dms-direct-messages
 */

import { sign, encode, decode, encrypt, decrypt } from '@isc/core';
import type { Signature } from '@isc/core';
import { getPeerID, getKeypair, getPeerPublicKey, getPublicKey } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';

const DEFAULT_TTL = 86400 * 30; // 30 days

/**
 * Direct message structure
 */
export interface DirectMessage {
  id: string;
  type: 'dm';
  sender: string;
  recipient: string;
  encryptedContent: Uint8Array;
  timestamp: number;
  signature: Signature;
  read: boolean;
  groupID?: string;
}

/**
 * Group DM structure
 */
export interface GroupDM {
  groupID: string;
  name: string;
  members: string[];
  creator: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Send a 1:1 encrypted DM to a recipient
 */
export async function sendDM(recipient: string, content: string): Promise<DirectMessage> {
  const sender = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  // Get recipient's public key for encryption
  const recipientPublicKey = await getPeerPublicKey(recipient);
  if (!recipientPublicKey) {
    throw new Error(`Public key not found for recipient: ${recipient}`);
  }

  // Export public key for encryption
  const exportedKey = await crypto.subtle.exportKey('raw', recipientPublicKey);

  // Encrypt content
  const encryptedContent = await encrypt(content, new Uint8Array(exportedKey));

  // Create and sign message
  const messagePayload = {
    type: 'dm' as const,
    sender,
    recipient,
    timestamp: Date.now(),
  };

  const signature = await sign(encode(messagePayload), keypair.privateKey);

  const dm: DirectMessage = {
    id: `dm_${crypto.randomUUID()}`,
    type: 'dm',
    sender,
    recipient,
    encryptedContent,
    timestamp: messagePayload.timestamp,
    signature,
    read: false,
  };

  // Store locally
  await storeDM(dm);

  // Deliver via DHT
  await deliverDM(dm);

  return dm;
}

/**
 * Send a message to a group DM
 */
export async function sendGroupMessage(groupID: string, content: string): Promise<DirectMessage[]> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);

  const sender = await getPeerID();
  if (!group.members.includes(sender)) {
    throw new Error('Not a member of this group DM');
  }

  // Send to all other members
  const messages: DirectMessage[] = [];
  for (const member of group.members) {
    if (member !== sender) {
      const dm = await sendDM(member, content);
      dm.groupID = groupID;
      await storeDM(dm);
      messages.push(dm);
    }
  }

  return messages;
}

/**
 * Create a new group DM
 */
export async function createGroupDM(members: string[], name: string = ''): Promise<GroupDM> {
  const creator = await getPeerID();
  const uniqueMembers = [...new Set([...members, creator])];

  if (uniqueMembers.length > 8) {
    throw new Error('Group DMs are limited to 8 participants');
  }

  const group: GroupDM = {
    groupID: `group_${crypto.randomUUID()}`,
    name: name || `Group ${uniqueMembers.length}`,
    members: uniqueMembers,
    creator,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Store locally
  await storeGroupDM(group);

  // Notify members via DHT
  await notifyGroupEvent(group, 'created');

  return group;
}

/**
 * Add a member to a group DM (creator only)
 */
export async function addGroupMember(groupID: string, newMember: string): Promise<void> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);

  const sender = await getPeerID();
  if (sender !== group.creator) {
    throw new Error('Only the creator can add members');
  }

  if (group.members.includes(newMember)) {
    return; // Already a member
  }

  if (group.members.length >= 8) {
    throw new Error('Group DMs are limited to 8 participants');
  }

  group.members.push(newMember);
  group.updatedAt = Date.now();

  await storeGroupDM(group);
  await notifyGroupEvent(group, 'member_added', newMember);
}

/**
 * Remove a member from a group DM (creator only)
 */
export async function removeGroupMember(groupID: string, member: string): Promise<void> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);

  const sender = await getPeerID();
  if (sender !== group.creator) {
    throw new Error('Only the creator can remove members');
  }

  if (member === group.creator) {
    throw new Error('Cannot remove the creator');
  }

  group.members = group.members.filter((m) => m !== member);
  group.updatedAt = Date.now();

  await storeGroupDM(group);
  await notifyGroupEvent(group, 'member_removed', member);
}

/**
 * Leave a group DM
 */
export async function leaveGroupDM(groupID: string): Promise<void> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);

  const sender = await getPeerID();
  if (sender === group.creator) {
    throw new Error('Creator cannot leave. Transfer ownership or delete the group.');
  }

  group.members = group.members.filter((m) => m !== sender);
  group.updatedAt = Date.now();

  await storeGroupDM(group);
  await notifyGroupEvent(group, 'member_left', sender);
}

/**
 * Get DM conversation with a specific peer
 */
export async function getDMs(peerID: string, limit: number = 50): Promise<DirectMessage[]> {
  const myID = await getPeerID();
  const db = await getDMDB();

  return new Promise((resolve) => {
    const req = db.transaction('dms', 'readonly').objectStore('dms').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const conversation = all.filter(
        (dm: DirectMessage) =>
          (dm.sender === myID && dm.recipient === peerID) ||
          (dm.sender === peerID && dm.recipient === myID)
      );
      conversation.sort((a: DirectMessage, b: DirectMessage) => b.timestamp - a.timestamp);
      resolve(conversation.slice(0, limit));
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Get all conversations with last message and unread count
 */
export async function getConversations(): Promise<
  Array<{ peerID: string; lastMessage: DirectMessage; unread: number }>
> {
  const myID = await getPeerID();
  const db = await getDMDB();

  return new Promise((resolve) => {
    const req = db.transaction('dms', 'readonly').objectStore('dms').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const peerMessages = new Map<string, DirectMessage[]>();
      for (const dm of all) {
        if (!dm.groupID) {
          const peer = dm.sender === myID ? dm.recipient : dm.sender;
          if (!peerMessages.has(peer)) {
            peerMessages.set(peer, []);
          }
          peerMessages.get(peer)!.push(dm);
        }
      }

      const conversations = Array.from(peerMessages.entries()).map(([peerID, messages]) => {
        messages.sort((a, b) => b.timestamp - a.timestamp);
        const unread = messages.filter(
          (dm) => dm.sender === peerID && !dm.read
        ).length;

        return {
          peerID,
          lastMessage: messages[0],
          unread,
        };
      });

      conversations.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
      resolve(conversations);
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Get all group DMs the user is a member of
 */
export async function getGroupDMs(): Promise<GroupDM[]> {
  const myID = await getPeerID();
  const db = await getDMDB();

  return new Promise((resolve) => {
    const req = db.transaction('group_dms', 'readonly').objectStore('group_dms').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      resolve(all.filter((g: GroupDM) => g.members.includes(myID)));
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Get a specific group DM by ID
 */
export async function getGroupDM(groupID: string): Promise<GroupDM | null> {
  const db = await getDMDB();
  return new Promise((resolve) => {
    const req = db.transaction('group_dms', 'readonly').objectStore('group_dms').get(groupID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

/**
 * Decrypt a DM message
 */
export async function decryptDM(dm: DirectMessage): Promise<string> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const exportedKey = await crypto.subtle.exportKey('raw', keypair.privateKey);
  return decrypt(dm.encryptedContent, new Uint8Array(exportedKey));
}

/**
 * Mark a DM as read
 */
export async function markAsRead(dmID: string): Promise<void> {
  const db = await getDMDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('dms', 'readonly').objectStore('dms').get(dmID);
    req.onsuccess = () => {
      const dm = req.result;
      if (dm) {
        dm.read = true;
        const putReq = db.transaction('dms', 'readwrite').objectStore('dms').put(dm);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mark all DMs from a peer as read
 */
export async function markAllAsRead(peerID: string): Promise<void> {
  const myID = await getPeerID();
  const db = await getDMDB();

  return new Promise((resolve, reject) => {
    const req = db.transaction('dms', 'readonly').objectStore('dms').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const tx = db.transaction('dms', 'readwrite');
      const store = tx.objectStore('dms');
      
      let completed = 0;
      for (const dm of all) {
        if (dm.sender === peerID && dm.recipient === myID && !dm.read) {
          dm.read = true;
          const putReq = store.put(dm);
          putReq.onsuccess = () => {
            completed++;
            if (completed >= all.filter((d: DirectMessage) => d.sender === peerID && d.recipient === myID && !d.read).length) {
              resolve();
            }
          };
        } else {
          completed++;
        }
      }
      if (completed >= all.length) resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get unread DM count from a peer
 */
export async function getUnreadCount(peerID: string): Promise<number> {
  const myID = await getPeerID();
  const db = await getDMDB();

  return new Promise((resolve) => {
    const req = db.transaction('dms', 'readonly').objectStore('dms').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const count = all.filter(
        (dm: DirectMessage) => dm.sender === peerID && dm.recipient === myID && !dm.read
      ).length;
      resolve(count);
    };
    req.onerror = () => resolve(0);
  });
}

/**
 * Delete a DM
 */
export async function deleteDM(dmID: string): Promise<void> {
  const db = await getDMDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('dms', 'readwrite').objectStore('dms').delete(dmID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============================================================================
// Storage and Delivery Helpers
// ============================================================================

async function storeDM(dm: DirectMessage): Promise<void> {
  const db = await getDMDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('dms', 'readwrite').objectStore('dms').put(dm);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function storeGroupDM(group: GroupDM): Promise<void> {
  const db = await getDMDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('group_dms', 'readwrite').objectStore('group_dms').put(group);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deliverDM(dm: DirectMessage): Promise<void> {
  const client = DelegationClient.getInstance();
  if (!client) return;

  const key = `/isc/dm/inbox/${dm.recipient}`;
  await client.announce(key, encode(dm), DEFAULT_TTL);
}

async function notifyGroupEvent(
  group: GroupDM,
  eventType: 'created' | 'member_added' | 'member_removed' | 'member_left',
  member?: string
): Promise<void> {
  const client = DelegationClient.getInstance();
  if (!client) return;

  const event = {
    type: eventType,
    groupID: group.groupID,
    member,
    timestamp: Date.now(),
  };

  // Notify all members
  for (const memberID of group.members) {
    const key = `/isc/group_dm/${memberID}/${group.groupID}`;
    await client.announce(key, encode(event), DEFAULT_TTL);
  }
}

async function getDMDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-dms', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('dms')) {
        db.createObjectStore('dms', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('group_dms')) {
        db.createObjectStore('group_dms', { keyPath: 'groupID' });
      }
    };
  });
}
