/**
 * DM Delivery Service
 *
 * Handles message delivery and group event notifications via DHT.
 */

import { encode } from '@isc/core';
import { DelegationClient } from '../../../delegation/fallback.js';
import type { DirectMessage, GroupDM, GroupDMEvent, GroupEventType } from '../types/dm.js';
import { DM_CONFIG, DM_DHT_PREFIXES } from '../config/dmConfig.js';

export class DMDeliveryService {
  /**
   * Deliver DM to recipient
   */
  static async deliverDM(dm: DirectMessage): Promise<void> {
    const client = DelegationClient.getInstance();
    if (!client) return;

    const key = `${DM_DHT_PREFIXES.INBOX}/${dm.recipient}`;
    await client.announce(key, encode(dm), DM_CONFIG.defaultTTL);
  }

  /**
   * Notify group of event
   */
  static async notifyGroupEvent(
    group: GroupDM,
    eventType: GroupEventType,
    member?: string
  ): Promise<void> {
    const client = DelegationClient.getInstance();
    if (!client) return;

    const event: GroupDMEvent = {
      type: eventType,
      groupID: group.groupID,
      member,
      timestamp: Date.now(),
    };

    for (const memberID of group.members) {
      const key = `${DM_DHT_PREFIXES.GROUP_DM}/${memberID}/${group.groupID}`;
      await client.announce(key, encode(event), DM_CONFIG.defaultTTL);
    }
  }
}
