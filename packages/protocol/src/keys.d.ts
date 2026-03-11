declare const DHT_KEYS: {
    ANNOUNCE: (modelHash: string, lshHash: string) => string;
    DELEGATE: (peerID: string) => string;
    MUTE: (peerID: string) => string;
    MODEL_REGISTRY: string;
    POST: (modelHash: string, lshHash: string) => string;
    LIKES: (postID: string) => string;
    REPOSTS: (postID: string) => string;
    REPLIES: (postID: string) => string;
    PROFILE: (peerID: string) => string;
    FOLLOW: (peerID: string) => string;
    TRENDING: (modelHash: string) => string;
};
export { DHT_KEYS };
//# sourceMappingURL=keys.d.ts.map