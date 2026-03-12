import { sign, encode, decrypt, encrypt } from '@isc/core';
import type { Signature } from '@isc/core';
import { getPeerID, getKeypair, getPeerPublicKey } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { openDB, dbGet, dbGetAll, dbPut } from '@isc/adapters';

const DEFAULT_TTL = 86400 * 30;
const DB_NAME = 'isc-dms';
const DB_VERSION = 1;

let dmDb: IDBDatabase | null = null;

async function getDMDB(): Promise<IDBDatabase> {
  if (dmDb) return dmDb;

  dmDb = await openDB(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains('dms')) {
      db.createObjectStore('dms', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('group_dms')) {
      db.createObjectStore('group_dms', { keyPath: 'groupID' });
    }
  });

  return dmDb;
}

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

export interface GroupDM {
  groupID: string;
  name: string;
  members: string[];
  creator: string;
  createdAt: number;
  updatedAt: number;
}

async function createAndSignMessage(
  type: 'dm' | 'group',
  sender: string,
  recipient: string,
  timestamp: number
): Promise<{ payload: object; signature: Signature }> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const payload = { type, sender, recipient, timestamp };
  const signature = await sign(encode(payload), keypair.privateKey);
  return { payload, signature };
}

async function encryptContent(content: string, recipient: string): Promise<Uint8Array> {
  const publicKey = await getPeerPublicKey(recipient);
  if (!publicKey) throw new Error(`Public key not found for recipient: ${recipient}`);

  const exportedKey = await crypto.subtle.exportKey('raw', publicKey);
  return encrypt(content, new Uint8Array(exportedKey));
}

async function storeDM(dm: DirectMessage): Promise<void> {
  const db = await getDMDB();
  await dbPut(db, 'dms', dm);
}

async function storeGroupDM(group: GroupDM): Promise<void> {
  const db = await getDMDB();
  await dbPut(db, 'group_dms', group);
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

  const event = { type: eventType, groupID: group.groupID, member, timestamp: Date.now() };

  for (const memberID of group.members) {
    const key = `/isc/group_dm/${memberID}/${group.groupID}`;
    await client.announce(key, encode(event), DEFAULT_TTL);
  }
}

export async function sendDM(recipient: string, content: string): Promise<DirectMessage> {
  const sender = await getPeerID();
  const encryptedContent = await encryptContent(content, recipient);
  const timestamp = Date.now();
  const { signature } = await createAndSignMessage('dm', sender, recipient, timestamp);

  const dm: DirectMessage = {
    id: `dm_${crypto.randomUUID()}`,
    type: 'dm',
    sender,
    recipient,
    encryptedContent,
    timestamp,
    signature,
    read: false,
  };

  await storeDM(dm);
  await deliverDM(dm);
  return dm;
}

export async function sendGroupMessage(groupID: string, content: string): Promise<DirectMessage[]> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);

  const sender = await getPeerID();
  if (!group.members.includes(sender)) throw new Error('Not a member of this group DM');

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

export async function createGroupDM(members: string[], name: string = ''): Promise<GroupDM> {
  const creator = await getPeerID();
  const uniqueMembers = [...new Set([...members, creator])];

  if (uniqueMembers.length > 8) throw new Error('Group DMs are limited to 8 participants');

  const group: GroupDM = {
    groupID: `group_${crypto.randomUUID()}`,
    name: name || `Group ${uniqueMembers.length}`,
    members: uniqueMembers,
    creator,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await storeGroupDM(group);
  await notifyGroupEvent(group, 'created');
  return group;
}

export async function addGroupMember(groupID: string, newMember: string): Promise<void> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);

  const sender = await getPeerID();
  if (sender !== group.creator) throw new Error('Only the creator can add members');
  if (group.members.includes(newMember)) return;
  if (group.members.length >= 8) throw new Error('Group DMs are limited to 8 participants');

  group.members.push(newMember);
  group.updatedAt = Date.now();

  await storeGroupDM(group);
  await notifyGroupEvent(group, 'member_added', newMember);
}

export async function removeGroupMember(groupID: string, member: string): Promise<void> {
  const group = await getGroupDM(groupID);
  if (!group) throw new Error(`Group DM ${groupID} not found`);

  const sender = await getPeerID();
  if (sender !== group.creator) throw new Error('Only the creator can remove members');
  if (member === group.creator) throw new Error('Cannot remove the creator');

  group.members = group.members.filter((m) => m !== member);
  group.updatedAt = Date.now();

  await storeGroupDM(group);
  await notifyGroupEvent(group, 'member_removed', member);
}

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

export async function getDMs(peerID: string, limit: number = 50): Promise<DirectMessage[]> {
  const myID = await getPeerID();
  const db = await getDMDB();
  const all = await dbGetAll<DirectMessage>(db, 'dms');

  const conversation = all.filter(
    (dm) =>
      (dm.sender === myID && dm.recipient === peerID) ||
      (dm.sender === peerID && dm.recipient === myID)
  );
  conversation.sort((a, b) => b.timestamp - a.timestamp);
  return conversation.slice(0, limit);
}

export async function getConversations(): Promise<
  Array<{ peerID: string; lastMessage: DirectMessage; unread: number }>
> {
  const myID = await getPeerID();
  const db = await getDMDB();
  const all = await dbGetAll<DirectMessage>(db, 'dms');

  const peerMessages = new Map<string, DirectMessage[]>();
  for (const dm of all) {
    if (!dm.groupID) {
      const peer = dm.sender === myID ? dm.recipient : dm.sender;
      if (!peerMessages.has(peer)) peerMessages.set(peer, []);
      peerMessages.get(peer)!.push(dm);
    }
  }

  const conversations = Array.from(peerMessages.entries()).map(([peerID, messages]) => {
    messages.sort((a, b) => b.timestamp - a.timestamp);
    const unread = messages.filter((dm) => dm.sender === peerID && !dm.read).length;
    return { peerID, lastMessage: messages[0], unread };
  });

  conversations.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
  return conversations;
}

export async function getGroupDMs(): Promise<GroupDM[]> {
  const myID = await getPeerID();
  const db = await getDMDB();
  const all = await dbGetAll<GroupDM>(db, 'group_dms');
  return all.filter((g) => g.members.includes(myID));
}

export async function getGroupDM(groupID: string): Promise<GroupDM | null> {
  const db = await getDMDB();
  return dbGet<GroupDM>(db, 'group_dms', groupID);
}

export async function decryptDM(dm: DirectMessage): Promise<string> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const exportedKey = await crypto.subtle.exportKey('raw', keypair.privateKey);
  return decrypt(dm.encryptedContent, new Uint8Array(exportedKey));
}

export async function markAsRead(dmID: string): Promise<void> {
  const db = await getDMDB();
  const dm = await dbGet<DirectMessage>(db, 'dms', dmID);
  if (dm) {
    dm.read = true;
    await dbPut(db, 'dms', dm);
  }
}

export async function markAllAsRead(peerID: string): Promise<void> {
  const myID = await getPeerID();
  const db = await getDMDB();
  const all = await dbGetAll<DirectMessage>(db, 'dms');

  for (const dm of all) {
    if (dm.sender === peerID && dm.recipient === myID && !dm.read) {
      dm.read = true;
      await dbPut(db, 'dms', dm);
    }
  }
}

export async function getUnreadCount(peerID: string): Promise<number> {
  const myID = await getPeerID();
  const db = await getDMDB();
  const all = await dbGetAll<DirectMessage>(db, 'dms');
  return all.filter((dm) => dm.sender === peerID && dm.recipient === myID && !dm.read).length;
}

export async function deleteDM(dmID: string): Promise<void> {
  const db = await getDMDB();
  await dbGet<DirectMessage>(db, 'dms', dmID).then((dm) => {
    if (dm) dbPut(db, 'dms', { ...dm, deleted: true });
  });
}
