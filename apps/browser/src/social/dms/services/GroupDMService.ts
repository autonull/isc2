/**
 * Group DM Service
 *
 * Handles group DM creation and member management.
 */

import { sign, encode, type Signature } from '@isc/core';
import { getPeerID, getKeypair } from '../../../identity/index.js';
import type { DirectMessage, GroupDM, GroupEventType } from '../types/dm.js';
import { DM_CONFIG } from '../config/dmConfig.js';
import { DMStorageService } from './DMStorageService.js';
import { DMDeliveryService } from './DMDeliveryService.js';
import { DMEncryptionService } from './DMEncryptionService.js';

export class GroupDMService {
  /**
   * Create and sign message payload
   */
  private static async createAndSignMessage(
    type: 'dm' | 'group',
    sender: string,
    recipient: string,
    timestamp: number
  ): Promise<Signature> {
    const keypair = getKeypair();
    if (!keypair) {
      throw new Error('Identity not initialized');
    }

    const payload = { type, sender, recipient, timestamp };
    return await sign(encode(payload), keypair.privateKey);
  }

  /**
   * Create group DM
   */
  static async createGroup(members: string[], name: string = ''): Promise<GroupDM> {
    const creator = await getPeerID();
    const uniqueMembers = [...new Set([...members, creator])];

    if (uniqueMembers.length > DM_CONFIG.maxGroupSize) {
      throw new Error(`Group DMs are limited to ${DM_CONFIG.maxGroupSize} participants`);
    }

    const group: GroupDM = {
      groupID: `group_${crypto.randomUUID()}`,
      name: name || `Group ${uniqueMembers.length}`,
      members: uniqueMembers,
      creator,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await DMStorageService.storeGroupDM(group);
    await DMDeliveryService.notifyGroupEvent(group, 'created');
    return group;
  }

  /**
   * Get group DM
   */
  static async getGroup(groupID: string): Promise<GroupDM | null> {
    return DMStorageService.getGroupDM(groupID);
  }

  /**
   * Get all group DMs for current user
   */
  static async getGroups(): Promise<GroupDM[]> {
    const myID = await getPeerID();
    const all = await DMStorageService.getAllGroupDMs();
    return all.filter((g) => g.members.includes(myID));
  }

  /**
   * Add member to group
   */
  static async addMember(groupID: string, newMember: string): Promise<void> {
    const group = await this.getGroup(groupID);
    if (!group) {
      throw new Error(`Group DM ${groupID} not found`);
    }

    const sender = await getPeerID();
    if (sender !== group.creator) {
      throw new Error('Only the creator can add members');
    }
    if (group.members.includes(newMember)) {
      return;
    }
    if (group.members.length >= DM_CONFIG.maxGroupSize) {
      throw new Error(`Group DMs are limited to ${DM_CONFIG.maxGroupSize} participants`);
    }

    group.members.push(newMember);
    group.updatedAt = Date.now();

    await DMStorageService.storeGroupDM(group);
    await DMDeliveryService.notifyGroupEvent(group, 'member_added', newMember);
  }

  /**
   * Remove member from group
   */
  static async removeMember(groupID: string, member: string): Promise<void> {
    const group = await this.getGroup(groupID);
    if (!group) {
      throw new Error(`Group DM ${groupID} not found`);
    }

    const sender = await getPeerID();
    if (sender !== group.creator) {
      throw new Error('Only the creator can remove members');
    }
    if (member === group.creator) {
      throw new Error('Cannot remove the creator');
    }

    group.members = group.members.filter((m) => m !== member);
    group.updatedAt = Date.now();

    await DMStorageService.storeGroupDM(group);
    await DMDeliveryService.notifyGroupEvent(group, 'member_removed', member);
  }

  /**
   * Leave group DM
   */
  static async leaveGroup(groupID: string): Promise<void> {
    const group = await this.getGroup(groupID);
    if (!group) {
      throw new Error(`Group DM ${groupID} not found`);
    }

    const sender = await getPeerID();
    if (sender === group.creator) {
      throw new Error('Creator cannot leave. Transfer ownership or delete the group.');
    }

    group.members = group.members.filter((m) => m !== sender);
    group.updatedAt = Date.now();

    await DMStorageService.storeGroupDM(group);
    await DMDeliveryService.notifyGroupEvent(group, 'member_left', sender);
  }

  /**
   * Send message to group
   */
  static async sendMessage(groupID: string, content: string): Promise<DirectMessage[]> {
    const group = await this.getGroup(groupID);
    if (!group) {
      throw new Error(`Group DM ${groupID} not found`);
    }

    const sender = await getPeerID();
    if (!group.members.includes(sender)) {
      throw new Error('Not a member of this group DM');
    }

    const messages: DirectMessage[] = [];
    for (const member of group.members) {
      if (member !== sender) {
        const dm = await this.sendDM(member, content);
        dm.groupID = groupID;
        await DMStorageService.storeDM(dm);
        messages.push(dm);
      }
    }

    return messages;
  }

  /**
   * Send direct message
   */
  static async sendDM(recipient: string, content: string): Promise<DirectMessage> {
    const sender = await getPeerID();
    const encryptedContent = await DMEncryptionService.encryptContent(content, recipient);
    const timestamp = Date.now();
    const signature = await this.createAndSignMessage('dm', sender, recipient, timestamp);

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

    await DMStorageService.storeDM(dm);
    await DMDeliveryService.deliverDM(dm);
    return dm;
  }
}
