/**
 * Direct Messages Service
 * 
 * Handles E2E encrypted 1:1 and group messages.
 * References: SOCIAL.md#dms-direct-messages
 */

import { sign, encode, encrypt, decrypt } from '@isc/core/crypto';
import type { Signature } from '@isc/core/crypto';
import { getPeerID, getKeypair } from '../identity';

/** Default TTL for DMs */
const DEFAULT_DM_TTL = 86400 * 30;

export interface DirectMessage {
  type: 'dm';
  sender: string;
  recipient: string;
  content: string;
  encrypted: Uint8Array;
  timestamp: number;
  signature: Signature;
  read?: boolean;
}

export interface DMPayload {
  type: 'dm';
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
}

export interface GroupDM {
  groupID: string;
  members: string[];
  creator: string;
  createdAt: number;
}

export async function sendDM(recipient: string, content: string): Promise<DirectMessage> {
  const sender = await getPeerID();
  const keypair = await getKeypair();
  const recipientPublicKey = await getRecipientPublicKey(recipient);
  const encrypted = await encrypt(content, recipientPublicKey);
  
  const payload: DMPayload = { type: 'dm', sender, recipient, content, timestamp: Date.now() };
  const signature = await sign(encode(payload), keypair.privateKey);
  
  const dm: DirectMessage = {
    type: 'dm', sender, recipient, content: '', encrypted,
    timestamp: payload.timestamp, signature,
  };
  
  await storeDM(dm);
  await deliverDM(dm);
  return dm;
}

export async function sendGroupDM(groupID: string, content: string): Promise<DirectMessage[]> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);
  
  const sender = await getPeerID();
  const messages: DirectMessage[] = [];
  for (const member of group.members) {
    if (member !== sender) {
      messages.push(await sendDM(member, content));
    }
  }
  return messages;
}

export async function createGroupDM(members: string[]): Promise<GroupDM> {
  const creator = await getPeerID();
  const uniqueMembers = [...new Set([...members, creator])];
  const group: GroupDM = { groupID: `group-dm-${Date.now()}-${creator.slice(0, 8)}`, members: uniqueMembers, creator, createdAt: Date.now() };
  await storeGroupDM(group);
  for (const member of uniqueMembers) await notifyGroupJoin(group, member);
  return group;
}

export async function addGroupMember(groupID: string, newMember: string): Promise<void> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);
  const sender = await getPeerID();
  if (sender !== group.creator) throw new Error('Only creator can add members');
  if (!group.members.includes(newMember)) {
    group.members.push(newMember);
    await storeGroupDM(group);
    await notifyGroupJoin(group, newMember);
  }
}

export async function removeGroupMember(groupID: string, member: string): Promise<void> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);
  const sender = await getPeerID();
  if (sender !== group.creator) throw new Error('Only creator can remove members');
  if (member !== group.creator) {
    group.members = group.members.filter(m => m !== member);
    await storeGroupDM(group);
    await notifyGroupLeave(group, member);
  }
}

export async function decryptDM(dm: DirectMessage): Promise<string> {
  const keypair = await getKeypair();
  return decrypt(dm.encrypted, keypair.privateKey);
}

export async function getConversation(peerID: string, limit: number = 50): Promise<DirectMessage[]> {
  const myID = await getPeerID();
  try {
    const db = await getIndexedDB();
    const all = await db.transaction('dms', 'readonly').objectStore('dms').getAll();
    const conversation = all.filter(dm => (dm.sender === myID && dm.recipient === peerID) || (dm.sender === peerID && dm.recipient === myID));
    conversation.sort((a, b) => b.timestamp - a.timestamp);
    return conversation.slice(0, limit);
  } catch { return []; }
}

export async function getConversations(): Promise<{ peerID: string; lastMessage: DirectMessage; unread: number }[]> {
  const myID = await getPeerID();
  try {
    const db = await getIndexedDB();
    const all = await db.transaction('dms', 'readonly').objectStore('dms').getAll();
    const peerMessages = new Map<string, DirectMessage[]>();
    for (const dm of all) {
      if (dm.sender === myID || dm.recipient === myID) {
        const peer = dm.sender === myID ? dm.recipient : dm.sender;
        if (!peerMessages.has(peer)) peerMessages.set(peer, []);
        peerMessages.get(peer)!.push(dm);
      }
    }
    const conversations = Array.from(peerMessages.entries()).map(([peerID, messages]) => {
      messages.sort((a, b) => b.timestamp - a.timestamp);
      return { peerID, lastMessage: messages[0], unread: messages.filter(dm => dm.sender === peerID && !dm.read).length };
    });
    conversations.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
    return conversations;
  } catch { return []; }
}

export async function markAsRead(dmID: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    const dm = await db.transaction('dms', 'readonly').objectStore('dms').get(dmID);
    if (dm) { dm.read = true; await db.transaction('dms', 'readwrite').objectStore('dms').put(dm); }
  } catch {}
}

export async function getMyGroupDMs(): Promise<GroupDM[]> {
  const myID = await getPeerID();
  try {
    const db = await getIndexedDB();
    const all = await db.transaction('group-dms', 'readonly').objectStore('group-dms').getAll();
    return all.filter(g => g.members.includes(myID));
  } catch { return []; }
}

async function storeDM(dm: DirectMessage): Promise<void> {
  try {
    const db = await getIndexedDB();
    await db.transaction('dms', 'readwrite').objectStore('dms').put({ ...dm, id: `${dm.sender}-${dm.timestamp}` });
  } catch {}
}

async function storeGroupDM(group: GroupDM): Promise<void> {
  try {
    const db = await getIndexedDB();
    await db.transaction('group-dms', 'readwrite').objectStore('group-dms').put(group);
  } catch {}
}

async function getGroupDM(groupID: string): Promise<GroupDM | null> {
  try {
    const db = await getIndexedDB();
    return await db.transaction('group-dms', 'readonly').objectStore('group-dms').get(groupID);
  } catch { return null; }
}

async function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-dms', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('dms')) db.createObjectStore('dms', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('group-dms')) db.createObjectStore('group-dms', { keyPath: 'groupID' });
    };
  });
}

async function getRecipientPublicKey(recipient: string): Promise<CryptoKey> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  const key = `/isc/identity/${recipient}/public-key`;
  const encoded = await client.query(key, 1);
  if (encoded.length > 0) {
    const keyData = JSON.parse(encoded[0]);
    return crypto.subtle.importKey('spki', new Uint8Array(keyData.data), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  }
  throw new Error(`Public key not found for ${recipient}`);
}

async function deliverDM(dm: DirectMessage): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  await client.announce(`/isc/dm/inbox/${dm.recipient}`, JSON.stringify(dm), DEFAULT_DM_TTL);
}

async function notifyGroupJoin(group: GroupDM, member: string): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  await client.announce(`/isc/group-dm/join/${group.groupID}`, JSON.stringify({ group, member, timestamp: Date.now() }), 300);
}

async function notifyGroupLeave(group: GroupDM, member: string): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  await client.announce(`/isc/group-dm/leave/${group.groupID}`, JSON.stringify({ group, member, timestamp: Date.now() }), 300);
}
