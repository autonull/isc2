/**
 * Thought Bridge Configuration
 */

export const THOUGHT_BRIDGE_CONFIG = {
  similarityThresholds: {
    verySimilar: 0.8,
    moderatelySimilar: 0.5,
    bridgingMin: 0.4,
    bridgingMax: 0.8,
    discussionMin: 0.3,
    discussionMax: 0.7,
    optimalSynthesis: 0.6,
  },
  limits: {
    maxCrossoverWords: 10,
    maxPostsToScan: 50,
    maxPostPairs: 20,
    maxConversationStarters: 5,
    maxBridgingPosts: 20,
    maxDiscussionTopics: 5,
  },
  stopwords: new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
    'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'as',
    'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its',
    'of', 'on', 'or', 'that', 'the', 'to', 'was', 'will', 'with',
  ]),
} as const;
