/**
 * Mock Data Generator for Development and Testing
 *
 * Generates realistic channels, posts, and users for UI development.
 */

import type { Channel, Relation } from '@isc/core';
import type { Post } from '../types/extended.js';

// Sample data pools
const CHANNEL_TOPICS = [
  'Artificial Intelligence',
  'Climate Change',
  'Space Exploration',
  'Quantum Computing',
  'Biotechnology',
  'Renewable Energy',
  'Neuroscience',
  'Philosophy',
  'Economics',
  'Psychology',
  'Mathematics',
  'History',
  'Literature',
  'Music Theory',
  'Art History',
];

const USER_NAMES = [
  'Alice Chen',
  'Bob Martinez',
  'Carol Johnson',
  'David Kim',
  'Emma Wilson',
  'Frank Zhang',
  'Grace Lee',
  'Henry Brown',
  'Iris Patel',
  'Jack Thompson',
  'Kate Anderson',
  'Leo Garcia',
  'Maya Singh',
  'Noah Williams',
  'Olivia Davis',
];

const POST_TEMPLATES = [
  'Just discovered something fascinating about {topic}. The implications are huge!',
  'Has anyone else been following the recent developments in {topic}? Would love to discuss.',
  "Here's my take on {topic}: I think we're approaching a paradigm shift.",
  "Reading about {topic} and I'm blown away by how much progress has been made.",
  'Question for the {topic} community: What do you think about the latest research?',
  'Sharing some thoughts on {topic}. Looking forward to hearing different perspectives.',
  'The intersection of {topic} and everyday life is more significant than most realize.',
  'Been diving deep into {topic} lately. Here are my key takeaways.',
  'Unpopular opinion about {topic}: I think the mainstream narrative is missing something.',
  'Exciting news in the world of {topic}! This could change everything.',
];

const COMMENTS = [
  "Great point! I hadn't considered that angle.",
  "This is exactly what I've been thinking lately.",
  'Interesting perspective. Have you looked into [related concept]?',
  "I respectfully disagree, and here's why...",
  'Could you elaborate on what you mean by that?',
  'This connects to what [someone] said earlier about...',
  "Adding to this: there's also the factor of...",
  'Thanks for sharing! This gives me a lot to think about.',
];

/**
 * Generate a random ID
 */
function generateId(prefix = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a random fingerprint (simulating public key)
 */
function generateFingerprint(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 40; i++) {
    if (i > 0 && i % 8 === 0) result += ':';
    result += chars[Math.floor(Math.random() * chars.length)];
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate mock relations for a channel
 */
function generateRelations(_topic: string): Relation[] {
  const relationTags = [
    'machine learning',
    'ethics',
    'research',
    'applications',
    'future',
    'challenges',
    'breakthroughs',
  ];

  const count = Math.floor(Math.random() * 3) + 2; // 2-4 relations
  const shuffled = relationTags.sort(() => 0.5 - Math.random());

  return shuffled.slice(0, count).map((tag) => ({
    tag,
    weight: 0.5 + Math.random() * 0.5,
  }));
}

/**
 * Generate a mock channel
 */
export function generateChannel(overrides?: Partial<Channel>): Channel {
  const topic = CHANNEL_TOPICS[Math.floor(Math.random() * CHANNEL_TOPICS.length)];
  const spread = Math.floor(Math.random() * 80) + 10; // 10-90

  return {
    id: generateId('channel-'),
    name: topic,
    description: `A community for discussing ${topic.toLowerCase()}. Share insights, research, and perspectives on this fascinating field.`,
    spread,
    relations: generateRelations(topic),
    createdAt: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
    updatedAt: Date.now(),
    active: Math.random() > 0.2, // 80% active
    distributions: [],
    ...overrides,
  };
}

/**
 * Generate a mock post
 */
export function generatePost(
  channelId: string,
  channelName: string,
  overrides?: Partial<Post>
): Post {
  const template = POST_TEMPLATES[Math.floor(Math.random() * POST_TEMPLATES.length)];
  const content = template.replace('{topic}', channelName.toLowerCase());

  return {
    id: generateId('post-'),
    author: generateFingerprint(),
    content,
    channelID: channelId,
    timestamp: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
    signature: new Uint8Array(0),
    likeCount: Math.floor(Math.random() * 100),
    repostCount: Math.floor(Math.random() * 30),
    replyCount: Math.floor(Math.random() * 20),
    ...overrides,
  } as Post;
}

/**
 * Generate a mock user profile
 */
export function generateUser(overrides?: any) {
  const name = USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)];
  const fingerprint = generateFingerprint();

  return {
    id: fingerprint,
    name,
    displayName: name,
    bio: `Passionate about ${CHANNEL_TOPICS[Math.floor(Math.random() * CHANNEL_TOPICS.length)].toLowerCase()}. Always learning.`,
    avatar: null,
    followerCount: Math.floor(Math.random() * 500),
    followingCount: Math.floor(Math.random() * 200),
    postCount: Math.floor(Math.random() * 100),
    joinedAt: Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

/**
 * Generate a mock comment/reply
 */
export function generateComment(postId: string, overrides?: any) {
  const content = COMMENTS[Math.floor(Math.random() * COMMENTS.length)];

  return {
    id: generateId('comment-'),
    postId,
    author: generateFingerprint(),
    content,
    timestamp: Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000), // Last 24 hours
    ...overrides,
  };
}

/**
 * Generate a complete mock dataset
 */
export interface MockDataset {
  channels: Channel[];
  posts: Post[];
  users: any[];
  comments: any[];
}

export function generateMockDataset(options?: {
  channelCount?: number;
  postsPerChannel?: number;
  commentsPerPost?: number;
}): MockDataset {
  const channelCount = options?.channelCount ?? 10;
  const postsPerChannel = options?.postsPerChannel ?? 5;
  const commentsPerPost = options?.commentsPerPost ?? 3;

  const channels: Channel[] = [];
  const posts: Post[] = [];
  const users = new Map<string, any>();
  const comments: any[] = [];

  // Generate channels
  for (let i = 0; i < channelCount; i++) {
    const channel = generateChannel();
    channels.push(channel);
  }

  // Generate posts for each channel
  for (const channel of channels) {
    for (let j = 0; j < postsPerChannel; j++) {
      const post = generatePost(channel.id, channel.name);
      posts.push(post);

      // Track unique users
      if (!users.has(post.author)) {
        users.set(post.author, generateUser({ id: post.author }));
      }

      // Generate comments
      for (let k = 0; k < commentsPerPost; k++) {
        const comment = generateComment(post.id);
        comments.push(comment);

        if (!users.has(comment.author)) {
          users.set(comment.author, generateUser({ id: comment.author }));
        }
      }
    }
  }

  return {
    channels,
    posts: posts.sort((a, b) => b.timestamp - a.timestamp), // Newest first
    users: Array.from(users.values()),
    comments,
  };
}

/**
 * Generate a specific scenario for testing
 */
export const scenarios = {
  /** Empty state - no channels or posts */
  empty: (): MockDataset => ({
    channels: [],
    posts: [],
    users: [],
    comments: [],
  }),

  /** Single channel with a few posts */
  starter: (): MockDataset => {
    const channel = generateChannel({ name: 'Getting Started' });
    const posts = [
      generatePost(channel.id, channel.name, {
        content: 'Welcome to ISC! This is your first channel. Start posting to see how it works.',
        likeCount: 5,
      }),
      generatePost(channel.id, channel.name, {
        content:
          "Tip: Create channels about topics you're passionate about. The more specific, the better the matches!",
        likeCount: 3,
      }),
    ];
    return {
      channels: [channel],
      posts,
      users: [generateUser()],
      comments: [],
    };
  },

  /** Active community with many channels and posts */
  active: (): MockDataset =>
    generateMockDataset({
      channelCount: 15,
      postsPerChannel: 8,
      commentsPerPost: 4,
    }),

  /** User with many posts (for profile view) */
  prolificUser: (): MockDataset => {
    const user = generateUser({ name: 'Active User' });
    const channel = generateChannel({ name: 'Test Channel' });
    const posts = Array.from({ length: 20 }, () =>
      generatePost(channel.id, channel.name, { author: user.id })
    );

    return {
      channels: [channel],
      posts,
      users: [user],
      comments: [],
    };
  },

  /** Thread with many replies */
  thread: (postId?: string): MockDataset => {
    const channel = generateChannel();
    const post = generatePost(channel.id, channel.name);
    const actualPostId = postId || post.id;

    const comments = Array.from({ length: 15 }, () => generateComment(actualPostId));

    return {
      channels: [channel],
      posts: [post],
      users: [generateUser()],
      comments,
    };
  },
};

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format engagement count (1.2k, 3.4M, etc.)
 */
export function formatCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
  return count.toString();
}
