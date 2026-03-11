/**
 * Core type definitions for ISC protocol.
 */
/**
 * A relation tag with optional object and weight.
 */
export interface Relation {
    tag: string;
    object?: string;
    weight?: number;
}
/**
 * A channel represents a named presence context.
 */
export interface Channel {
    id: string;
    name: string;
    description: string;
    spread: number;
    relations: Relation[];
    createdAt: number;
    updatedAt: number;
    active: boolean;
}
/**
 * A distribution in embedding space (mean vector and standard deviation).
 */
export interface Distribution {
    mu: number[];
    sigma: number;
    tag?: string;
    weight?: number;
}
/**
 * Device capabilities for tier detection.
 */
export interface DeviceCapabilities {
    cpuCores: number;
    memoryGB: number;
    networkType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
    saveData: boolean;
}
/**
 * Device tier classification.
 */
export type Tier = 'high' | 'mid' | 'low' | 'minimal';
/**
 * Network state for a peer.
 */
export interface NetworkState {
    peerId: string;
    tier: Tier;
    capabilities: DeviceCapabilities;
    channels: Channel[];
    lastSeen: number;
}
/**
 * Signed announcement payload for DHT.
 */
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
/**
 * Chat message format.
 */
export interface ChatMessage {
    channelID: string;
    msg: string;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Group invite message.
 */
export interface GroupInvite {
    type: 'group_invite';
    roomID: string;
    members: string[];
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Delegation request format.
 */
export interface DelegateRequest {
    id: string;
    operation: 'embed' | 'match' | 'sample';
    payload: unknown;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Delegation response format.
 */
export interface DelegateResponse {
    requestId: string;
    result: unknown;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Post content format.
 */
export interface Post {
    id: string;
    author: string;
    content: string;
    channelID: string;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Profile information.
 */
export interface Profile {
    peerID: string;
    bio?: string;
    channels: Channel[];
    updatedAt: number;
}
/**
 * Follow event format.
 */
export interface FollowEvent {
    follower: string;
    followee: string;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Mute event format.
 */
export interface MuteEvent {
    muter: string;
    muted: string;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Report event format.
 */
export interface ReportEvent {
    reporter: string;
    reported: string;
    reason: string;
    evidence: string[];
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Like event format.
 */
export interface LikeEvent {
    liker: string;
    postID: string;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Repost event format.
 */
export interface RepostEvent {
    reposter: string;
    postID: string;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Reply event format.
 */
export interface ReplyEvent {
    replyID: string;
    parentID: string;
    author: string;
    content: string;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Quote event format.
 */
export interface QuoteEvent {
    quoter: string;
    postID: string;
    content: string;
    timestamp: number;
    signature: Uint8Array;
}
/**
 * Channel summary for profile display.
 */
export interface ChannelSummary {
    id: string;
    name: string;
    description: string;
    meanVector: number[];
}
//# sourceMappingURL=types.d.ts.map