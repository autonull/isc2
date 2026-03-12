export interface Relation {
  tag: string;
  object?: string;
  weight?: number;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  spread: number;
  relations: Relation[];
  createdAt: number;
  updatedAt: number;
  active: boolean;
  distributions?: Distribution[];
}

export interface Distribution {
  mu: number[];
  sigma: number;
  tag?: string;
  weight?: number;
}

export interface DeviceCapabilities {
  cpuCores: number;
  memoryGB: number;
  networkType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  saveData: boolean;
}

export type Tier = 'high' | 'mid' | 'low' | 'minimal';

export interface NetworkState {
  peerId: string;
  tier: Tier;
  capabilities: DeviceCapabilities;
  channels: Channel[];
  lastSeen: number;
}

export interface SignedAnnouncement {
  peerID: string;
  channelID: string;
  model: string;
  vec: number[];
  relTag?: string;
  ttl: number;
  updatedAt: number;
  signature: Uint8Array;
}

export interface ChatMessage {
  channelID: string;
  msg: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface GroupInvite {
  type: 'group_invite';
  roomID: string;
  members: string[];
  timestamp: number;
  signature: Uint8Array;
}

export interface DelegateRequest {
  id: string;
  operation: 'embed' | 'match' | 'sample';
  payload: unknown;
  timestamp: number;
  signature: Uint8Array;
}

export interface DelegateResponse {
  requestId: string;
  result: unknown;
  timestamp: number;
  signature: Uint8Array;
}

export interface Post {
  id: string;
  author: string;
  content: string;
  channelID: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface Profile {
  peerID: string;
  bio?: string;
  channels: Channel[];
  updatedAt: number;
}

export interface FollowEvent {
  follower: string;
  followee: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface MuteEvent {
  muter: string;
  muted: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface ReportEvent {
  reporter: string;
  reported: string;
  reason: string;
  evidence: string[];
  timestamp: number;
  signature: Uint8Array;
}

export interface LikeEvent {
  liker: string;
  postID: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface RepostEvent {
  reposter: string;
  postID: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface ReplyEvent {
  replyID: string;
  parentID: string;
  author: string;
  content: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface QuoteEvent {
  quoter: string;
  postID: string;
  content: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface ChannelSummary {
  id: string;
  name: string;
  description: string;
  meanVector: number[];
}
