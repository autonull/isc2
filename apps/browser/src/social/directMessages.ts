/**
 * Direct Messages
 *
 * Private encrypted messaging with group DM support.
 *
 * Facade module re-exporting DM functionality.
 */

export type {
  DirectMessage,
  GroupDM,
  GroupDMEvent,
  ConversationSummary,
  DMConfig,
  GroupEventType,
} from './dms/types/dm.js';

export { DM_CONFIG, DM_STORES, DM_DHT_PREFIXES } from './dms/config/dmConfig.js';

export { DMEncryptionService } from './dms/services/DMEncryptionService.js';
export { DMStorageService } from './dms/services/DMStorageService.js';
export { DMDeliveryService } from './dms/services/DMDeliveryService.js';
export { GroupDMService } from './dms/services/GroupDMService.js';
export { DMQueryService } from './dms/services/DMQueryService.js';

// Re-export for backward compatibility
import type { DirectMessage, GroupDM } from './dms/types/dm.js';
import { GroupDMService } from './dms/services/GroupDMService.js';
import { DMQueryService } from './dms/services/DMQueryService.js';
import { DMStorageService } from './dms/services/DMStorageService.js';
import { DMEncryptionService } from './dms/services/DMEncryptionService.js';
import { getPeerID } from '../identity/index.js';

/**
 * Send direct message
 */
export async function sendDM(recipient: string, content: string): Promise<DirectMessage> {
  return GroupDMService.sendDM(recipient, content);
}

/**
 * Send group message
 */
export async function sendGroupMessage(groupID: string, content: string): Promise<DirectMessage[]> {
  return GroupDMService.sendMessage(groupID, content);
}

/**
 * Create group DM
 */
export async function createGroupDM(members: string[], name: string = ''): Promise<GroupDM> {
  return GroupDMService.createGroup(members, name);
}

/**
 * Add member to group
 */
export async function addGroupMember(groupID: string, newMember: string): Promise<void> {
  return GroupDMService.addMember(groupID, newMember);
}

/**
 * Remove member from group
 */
export async function removeGroupMember(groupID: string, member: string): Promise<void> {
  return GroupDMService.removeMember(groupID, member);
}

/**
 * Leave group DM
 */
export async function leaveGroupDM(groupID: string): Promise<void> {
  return GroupDMService.leaveGroup(groupID);
}

/**
 * Get DMs with peer
 */
export async function getDMs(peerID: string, limit: number = 50): Promise<DirectMessage[]> {
  return DMQueryService.getDMs(peerID, limit);
}

/**
 * Get all conversations
 */
export async function getConversations(): Promise<
  Array<{ peerID: string; lastMessage: DirectMessage; unread: number }>
> {
  return DMQueryService.getConversations();
}

/**
 * Get all group DMs
 */
export async function getGroupDMs(): Promise<GroupDM[]> {
  return GroupDMService.getGroups();
}

/**
 * Get group DM by ID
 */
export async function getGroupDM(groupID: string): Promise<GroupDM | null> {
  return GroupDMService.getGroup(groupID);
}

/**
 * Decrypt DM content
 */
export async function decryptDM(dm: DirectMessage): Promise<string> {
  if (dm.type === 'session_init') {
    await DMEncryptionService.acceptSession(dm);
    return '[Secure session established]';
  }

  if (dm.messageNumber !== undefined && dm.mac && dm.iv && dm.dhPublic) {
    return DMEncryptionService.decryptContent(dm);
  }

  return DMEncryptionService.decryptContentLegacy(dm.encryptedContent);
}

/**
 * Mark DM as read
 */
export async function markAsRead(dmID: string): Promise<void> {
  return DMStorageService.markAsRead(dmID);
}

/**
 * Mark all DMs from peer as read
 */
export async function markAllAsRead(peerID: string): Promise<void> {
  return DMStorageService.markAllAsRead(peerID, await getPeerID());
}

/**
 * Get unread count for peer
 */
export async function getUnreadCount(peerID: string): Promise<number> {
  return DMQueryService.getUnreadCount(peerID);
}

/**
 * Delete DM (soft delete)
 */
export async function deleteDM(dmID: string): Promise<void> {
  return DMStorageService.deleteDM(dmID);
}
