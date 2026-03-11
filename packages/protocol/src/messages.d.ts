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
export interface Relation {
    type: 'spatial' | 'temporal' | 'semantic';
    tag?: string;
    weight: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
    start?: number;
    end?: number;
}
export interface Distribution {
    type: 'root' | 'spatial' | 'temporal' | 'semantic';
    mean: number[];
    std: number;
    weight: number;
    tag?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    start?: number;
    end?: number;
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
export interface AnnouncementPayload {
    channelID: string;
    model: string;
    vec: number[];
    relTag?: string;
    ttl: number;
    updatedAt: number;
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
export interface GroupRoom {
    id: string;
    members: string[];
    createdAt: number;
    updatedAt: number;
}
export interface DelegateRequest {
    type: 'delegate_request';
    requestID: string;
    service: 'embed' | 'ann_query' | 'sig_verify';
    payload: Uint8Array;
    requesterPubKey: Uint8Array;
    timestamp: number;
    signature: Uint8Array;
}
export interface DelegateResponse {
    type: 'delegate_response';
    requestID: string;
    service: 'embed' | 'ann_query' | 'sig_verify';
    payload: Uint8Array;
    responderPubKey: Uint8Array;
    timestamp: number;
    signature: Uint8Array;
}
export interface DelegateCapability {
    type: 'delegate_capability';
    peerID: string;
    services: ('embed' | 'ann_query' | 'sig_verify')[];
    rateLimit: {
        requestsPerMinute: number;
        maxConcurrent: number;
    };
    model: string;
    uptime: number;
    signature: Uint8Array;
}
export interface DelegationHealth {
    type: 'delegation_health';
    peerID: string;
    successRate: number;
    avgLatencyMs: number;
    requestsServed24h: number;
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
export interface SignedPost {
    payload: Post;
    signature: Uint8Array;
}
export interface PostPayload {
    content: string;
    channelID: string;
    timestamp: number;
}
export interface LikeEvent {
    type: 'like';
    postID: string;
    userID: string;
    timestamp: number;
    signature: Uint8Array;
}
export interface RepostEvent {
    type: 'repost';
    postID: string;
    userID: string;
    timestamp: number;
    signature: Uint8Array;
}
export interface ReplyEvent {
    type: 'reply';
    postID: string;
    userID: string;
    content: string;
    timestamp: number;
    signature: Uint8Array;
}
export interface QuoteEvent {
    type: 'quote';
    postID: string;
    userID: string;
    content: string;
    timestamp: number;
    signature: Uint8Array;
}
export interface Profile {
    peerID: string;
    name: string;
    bio: string;
    channels: ChannelSummary[];
    followers: string[];
    following: string[];
    createdAt: number;
    updatedAt: number;
}
export interface ChannelSummary {
    id: string;
    name: string;
    description: string;
    active: boolean;
}
export interface FollowEvent {
    type: 'follow';
    targetID: string;
    userID: string;
    timestamp: number;
    signature: Uint8Array;
}
export interface MuteEvent {
    type: 'mute';
    targetID: string;
    userID: string;
    timestamp: number;
    signature: Uint8Array;
}
export interface ReportEvent {
    type: 'report';
    targetID: string;
    userID: string;
    reason: string;
    timestamp: number;
    signature: Uint8Array;
}
//# sourceMappingURL=messages.d.ts.map