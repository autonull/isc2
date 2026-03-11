const DHT_KEYS = {
    ANNOUNCE: (modelHash, lshHash) => `/isc/announce/${modelHash}/${lshHash}`,
    DELEGATE: (peerID) => `/isc/delegate/${peerID}`,
    MUTE: (peerID) => `/isc/mute/${peerID}`,
    MODEL_REGISTRY: '/isc/model_registry',
    POST: (modelHash, lshHash) => `/isc/post/${modelHash}/${lshHash}`,
    LIKES: (postID) => `/isc/likes/${postID}`,
    REPOSTS: (postID) => `/isc/reposts/${postID}`,
    REPLIES: (postID) => `/isc/replies/${postID}`,
    PROFILE: (peerID) => `/isc/profile/channels/${peerID}`,
    FOLLOW: (peerID) => `/isc/follow/${peerID}`,
    TRENDING: (modelHash) => `/isc/trending/${modelHash}`,
};
export { DHT_KEYS };
//# sourceMappingURL=keys.js.map