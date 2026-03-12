export const DHT_KEYS = {
  ANNOUNCE: (modelHash: string, lshHash: string) => `/isc/announce/${modelHash}/${lshHash}`,
  DELEGATE: (peerID: string) => `/isc/delegate/${peerID}`,
  MUTE: (peerID: string) => `/isc/mute/${peerID}`,
  MODEL_REGISTRY: '/isc/model_registry',
  POST: (modelHash: string, lshHash: string) => `/isc/post/${modelHash}/${lshHash}`,
  LIKES: (postID: string) => `/isc/likes/${postID}`,
  REPOSTS: (postID: string) => `/isc/reposts/${postID}`,
  REPLIES: (postID: string) => `/isc/replies/${postID}`,
  PROFILE: (peerID: string) => `/isc/profile/channels/${peerID}`,
  FOLLOW: (peerID: string) => `/isc/follow/${peerID}`,
  TRENDING: (modelHash: string) => `/isc/trending/${modelHash}`,
} as const;
