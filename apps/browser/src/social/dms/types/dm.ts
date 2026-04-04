/* eslint-disable */
/**
 * Direct Message Type Definitions
 */

import type { Signature } from '@isc/core';

export type GroupEventType = 'created' | 'member_added' | 'member_removed' | 'member_left';

export interface DirectMessage {
  id: string;
  type: 'dm' | 'group' | 'session_init';
  sender: string;
  recipient: string;
  encryptedContent: Uint8Array;
  timestamp: number;
  signature: Signature;
  read: boolean;
  groupID?: string;
  deleted?: boolean;
  messageNumber?: number;
  dhPublic?: Uint8Array;
  mac?: Uint8Array;
  iv?: Uint8Array;
  sessionInit?: {
    initiatorPublic: Uint8Array;
    initiatorIdentity: string;
  };
  sealedSender?: {
    encryptedSender: Uint8Array;
    iv: Uint8Array;
    ephemeralPublicKey: Uint8Array;
  };
}

export interface GroupDM {
  groupID: string;
  name: string;
  members: string[];
  creator: string;
  createdAt: number;
  updatedAt: number;
}

export interface GroupDMEvent {
  type: GroupEventType;
  groupID: string;
  member?: string;
  timestamp: number;
}

export interface ConversationSummary {
  peerID: string;
  lastMessage: DirectMessage;
  unread: number;
}

export interface DMConfig {
  defaultTTL: number;
  dbName: string;
  dbVersion: number;
  maxGroupSize: number;
}
