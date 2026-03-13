/**
 * DM Query Service
 *
 * Handles querying and aggregating direct messages.
 */

import { getPeerID } from '../../../identity/index.js';
import type { DirectMessage, ConversationSummary } from '../types/dm.js';
import { DMStorageService } from './DMStorageService.js';

export class DMQueryService {
  /**
   * Get DMs with a specific peer
   */
  static async getDMs(peerID: string, limit: number = 50): Promise<DirectMessage[]> {
    const myID = await getPeerID();
    const all = await DMStorageService.getAllDMs();

    const conversation = all.filter(
      (dm) =>
        (dm.sender === myID && dm.recipient === peerID) ||
        (dm.sender === peerID && dm.recipient === myID)
    );

    conversation.sort((a, b) => b.timestamp - a.timestamp);
    return conversation.slice(0, limit);
  }

  /**
   * Get all conversations with summaries
   */
  static async getConversations(): Promise<ConversationSummary[]> {
    const myID = await getPeerID();
    const all = await DMStorageService.getAllDMs();

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
      const unread = messages.filter((dm) => dm.sender === peerID && !dm.read).length;
      return { peerID, lastMessage: messages[0], unread };
    });

    conversations.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
    return conversations;
  }

  /**
   * Get unread count for a peer
   */
  static async getUnreadCount(peerID: string): Promise<number> {
    const myID = await getPeerID();
    const all = await DMStorageService.getAllDMs();
    return all.filter(
      (dm) => dm.sender === peerID && dm.recipient === myID && !dm.read
    ).length;
  }
}
