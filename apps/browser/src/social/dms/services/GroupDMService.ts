/* eslint-disable */
/**
 * Group DM Service
 *
 * Handles group DM creation and member management.
 */

import { sign, encode, type Signature } from '@isc/core';
import { getPeerID, getKeypair } from '../../../identity/index.ts';
import type { DirectMessage, GroupDM } from '../types/dm.ts';
import { DM_CONFIG } from '../config/dmConfig.ts';
import { DMStorageService } from './DMStorageService.ts';
import { DMDeliveryService } from './DMDeliveryService.ts';
import { DMEncryptionService } from './DMEncryptionService.ts';

export class GroupDMService {
  private static async signMessage(
    type: 'dm' | 'group',
    sender: string,
    recipient: string,
    timestamp: number
  ): Promise<Signature> {
    const keypair =
      getKeypair() ??
      (() => {
        throw new Error('Identity not initialized');
      })();
    return sign(encode({ type, sender, recipient, timestamp }), keypair.privateKey);
  }

  static async createGroup(members: string[], name = ''): Promise<GroupDM> {
    const creator = await getPeerID();
    const uniqueMembers = [...new Set([creator, ...members])];

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

  static async getGroup(groupID: string): Promise<GroupDM | null> {
    return DMStorageService.getGroupDM(groupID);
  }

  static async getGroups(): Promise<GroupDM[]> {
    const myID = await getPeerID();
    const all = await DMStorageService.getAllGroupDMs();
    return all.filter((g) => g.members.includes(myID));
  }

  static async addMember(groupID: string, newMember: string): Promise<void> {
    const group =
      (await this.getGroup(groupID)) ??
      (() => {
        throw new Error(`Group DM ${groupID} not found`);
      })();
    if (group.members.includes(newMember)) return;
    if (group.members.length >= DM_CONFIG.maxGroupSize) {
      throw new Error(`Group DMs are limited to ${DM_CONFIG.maxGroupSize} participants`);
    }

    group.members.push(newMember);
    group.updatedAt = Date.now();
    await DMStorageService.storeGroupDM(group);
    await DMDeliveryService.notifyGroupEvent(group, 'member_added', newMember);
  }

  static async removeMember(groupID: string, member: string): Promise<void> {
    const group =
      (await this.getGroup(groupID)) ??
      (() => {
        throw new Error(`Group DM ${groupID} not found`);
      })();
    if (member === group.creator) throw new Error('Cannot remove the creator');

    group.members = group.members.filter((m) => m !== member);
    group.updatedAt = Date.now();
    await DMStorageService.storeGroupDM(group);
    await DMDeliveryService.notifyGroupEvent(group, 'member_removed', member);
  }

  static async leaveGroup(groupID: string): Promise<void> {
    const group =
      (await this.getGroup(groupID)) ??
      (() => {
        throw new Error(`Group DM ${groupID} not found`);
      })();
    const sender = await getPeerID();
    if (sender === group.creator) {
      throw new Error('Creator cannot leave. Transfer ownership or delete the group.');
    }

    group.members = group.members.filter((m) => m !== sender);
    group.updatedAt = Date.now();
    await DMStorageService.storeGroupDM(group);
    await DMDeliveryService.notifyGroupEvent(group, 'member_left', sender);
  }

  static async sendMessage(groupID: string, content: string): Promise<DirectMessage[]> {
    const group =
      (await this.getGroup(groupID)) ??
      (() => {
        throw new Error(`Group DM ${groupID} not found`);
      })();
    const sender = await getPeerID();
    if (!group.members.includes(sender)) throw new Error('Not a member of this group DM');

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

  static async sendDM(recipient: string, content: string): Promise<DirectMessage> {
    const sender = await getPeerID();
    const timestamp = Date.now();

    const hasSession = await DMEncryptionService.hasSession(recipient);
    if (!hasSession) {
      const initDM = await DMEncryptionService.initializeSession(recipient);
      await DMStorageService.storeDM(initDM);
      await DMDeliveryService.deliverDM(initDM);
    }

    const { encryptedContent, mac, iv, messageNumber, dhPublic } =
      await DMEncryptionService.encryptContent(content, recipient);

    const signature = await this.signMessage('dm', sender, recipient, timestamp);

    const dm: DirectMessage = {
      id: `dm_${crypto.randomUUID()}`,
      type: 'dm',
      sender,
      recipient,
      encryptedContent,
      timestamp,
      signature,
      read: false,
      messageNumber,
      dhPublic,
      mac,
      iv,
    };

    await DMStorageService.storeDM(dm);
    await DMDeliveryService.deliverDM(dm);
    return dm;
  }
}
