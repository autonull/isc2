/**
 * ISC Relay Node - Simulator Module
 *
 * Optional module that adds bot activity to the relay node.
 * Bots participate in the network like real users but are clearly marked.
 *
 * Capabilities:
 * - Create bot peers with configurable identities
 * - Post messages to channels
 * - Discover and interact with real peers
 * - Simulate typing, reactions, conversations
 */

import type { Libp2p } from 'libp2p';
import type { EmbeddingService } from '@isc/network';
import { generateKeyPair } from '@libp2p/crypto/keys';

export interface BotConfig {
  namePattern: string; // e.g., "{name} (Bot)"
  namePool: string[]; // First names to use
  bioTemplates: string[]; // Bio templates with {topic} placeholders
  topicPools: Record<string, string[]>; // Topic categories
  postIntervalMs: number; // Time between posts
  activeHours: [number, number]; // UTC hour range for activity
}

export interface BotPeer {
  id: string;
  name: string;
  bio: string;
  topics: string[];
  libp2p: Libp2p;
  embeddingService: EmbeddingService;
  active: boolean;
  postsCreated: number;
  lastActive: number;
}

export interface SimulatorMetrics {
  botCount: number;
  activeBots: number;
  totalPosts: number;
  totalChannels: number;
  messagesPerMinute: number;
  uptime: number;
}

const DEFAULT_CONFIG: BotConfig = {
  namePattern: '{name} (Bot)',
  namePool: ['Alex', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Quinn', 'Avery', 'Sam', 'Drew'],
  bioTemplates: [
    'Interested in {topic1} and {topic2}.',
    'Passionate about {topic1}. Always learning.',
    'Exploring {topic1}, {topic2}, and more.',
    '{topic1} enthusiast. Let\'s connect!',
    'Sharing thoughts on {topic1}.',
  ],
  topicPools: {
    tech: ['AI', 'machine learning', 'blockchain', 'web3', 'distributed systems'],
    science: ['physics', 'biology', 'neuroscience', 'climate', 'space'],
    arts: ['music', 'photography', 'design', 'writing', 'film'],
    philosophy: ['consciousness', 'ethics', 'metaphysics', 'stoicism'],
    lifestyle: ['meditation', 'fitness', 'cooking', 'travel', 'minimalism'],
  },
  postIntervalMs: 60000,
  activeHours: [0, 24],
};

export class Simulator {
  private config: BotConfig;
  private bots: Map<string, BotPeer> = new Map();
  private relayNode: Libp2p | null = null;
  private embeddingService: EmbeddingService | null = null;
  private postTimer: NodeJS.Timeout | null = null;
  private running = false;
  private metrics: { postsCreated: number; startTime: number } = { postsCreated: 0, startTime: Date.now() };

  constructor(config: Partial<BotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize simulator with relay node
   */
  async initialize(relayNode: Libp2p, embeddingService: EmbeddingService): Promise<void> {
    this.relayNode = relayNode;
    this.embeddingService = embeddingService;
    console.log('[Simulator] Initialized with relay node');
  }

  /**
   * Start the simulator
   */
  async start(botCount: number = 5): Promise<void> {
    if (this.running) return;
    if (!this.relayNode || !this.embeddingService) {
      throw new Error('Simulator not initialized - call initialize() first');
    }

    console.log(`[Simulator] Starting with ${botCount} bots...`);
    this.running = true;

    // Create bot peers
    for (let i = 0; i < botCount; i++) {
      await this.createBot();
    }

    // Start periodic activity
    this.postTimer = setInterval(() => this.tick(), this.config.postIntervalMs);
    console.log('[Simulator] Started');
  }

  /**
   * Stop the simulator
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    if (this.postTimer) {
      clearInterval(this.postTimer);
      this.postTimer = null;
    }

    // Stop all bots
    for (const [, bot] of this.bots.entries()) {
      await bot.libp2p.stop();
    }
    this.bots.clear();

    console.log('[Simulator] Stopped');
  }

  /**
   * Update simulator configuration
   */
  configure(updates: Partial<BotConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Add more bots
   */
  async addBots(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.createBot();
    }
  }

  /**
   * Remove bots
   */
  async removeBots(count: number): Promise<void> {
    const toRemove = Math.min(count, this.bots.size);
    const iterator = this.bots.keys();

    for (let i = 0; i < toRemove; i++) {
      const result = iterator.next();
      if (result.done) break;

      const botId = result.value;
      const bot = this.bots.get(botId);
      if (bot) {
        await bot.libp2p.stop();
        this.bots.delete(botId);
      }
    }
  }

  /**
   * Get simulator metrics
   */
  getMetrics(): SimulatorMetrics {
    const activeBots = Array.from(this.bots.values()).filter(b => b.active).length;
    const uptime = (Date.now() - this.metrics.startTime) / 1000;
    const messagesPerMinute = this.metrics.postsCreated / (uptime / 60);

    return {
      botCount: this.bots.size,
      activeBots,
      totalPosts: this.metrics.postsCreated,
      totalChannels: 0, // Would track separately
      messagesPerMinute: Math.round(messagesPerMinute * 10) / 10,
      uptime: Math.round(uptime),
    };
  }

  /**
   * Get bot list
   */
  getBots(): Array<{ id: string; name: string; active: boolean; postsCreated: number }> {
    return Array.from(this.bots.values()).map(bot => ({
      id: bot.id,
      name: bot.name,
      active: bot.active,
      postsCreated: bot.postsCreated,
    }));
  }

  /**
   * Create a single bot peer
   */
  private async createBot(): Promise<BotPeer> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not available');
    }

    // Generate identity
    const keypair = await generateKeyPair('Ed25519');
    const { createFromPrivKey } = await import('@libp2p/peer-id-factory');
    const peerId = await createFromPrivKey(keypair);

    // Generate name and bio
    const name = this.generateBotName();
    const { bio, topics } = this.generateBotBio();

    // Create libp2p node for bot
    const botNode = await this.createBotNode(peerId, keypair);

    const bot: BotPeer = {
      id: peerId.toString(),
      name,
      bio,
      topics,
      libp2p: botNode,
      embeddingService: this.embeddingService,
      active: true,
      postsCreated: 0,
      lastActive: Date.now(),
    };

    this.bots.set(bot.id, bot);
    console.log(`[Simulator] Created bot: ${name} (${bot.id.slice(-8)})`);

    return bot;
  }

  /**
   * Generate bot name using pattern
   */
  private generateBotName(): string {
    const name = this.config.namePool[Math.floor(Math.random() * this.config.namePool.length)];
    return this.config.namePattern.replace('{name}', name);
  }

  /**
   * Generate bot bio with topics
   */
  private generateBotBio(): { bio: string; topics: string[] } {
    const topicKeys = Object.keys(this.config.topicPools);
    const selectedPools = topicKeys.sort(() => Math.random() - 0.5).slice(0, 2);

    const topics = selectedPools.flatMap(pool => {
      const poolTopics = this.config.topicPools[pool];
      return poolTopics.sort(() => Math.random() - 0.5).slice(0, 2);
    });

    const template = this.config.bioTemplates[Math.floor(Math.random() * this.config.bioTemplates.length)];
    const bio = template
      .replace('{topic1}', topics[0] || 'ideas')
      .replace('{topic2}', topics[1] || 'learning');

    return { bio, topics };
  }

  /**
   * Create libp2p node for bot
   */
  private async createBotNode(peerId: any, keypair: any): Promise<Libp2p> {
    const { createLibp2p } = await import('libp2p');
    const { webSockets } = await import('@libp2p/websockets');
    const { noise } = await import('@chainsafe/libp2p-noise');
    const { yamux } = await import('@chainsafe/libp2p-yamux');
    const { kadDHT } = await import('@libp2p/kad-dht');
    const { gossipsub } = await import('@chainsafe/libp2p-gossipsub');

    return createLibp2p({
      peerId,
      addresses: { listen: [] }, // Don't listen, just connect
      transports: [webSockets()],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      services: {
        dht: kadDHT({ clientMode: true }),
        pubsub: gossipsub({ allowPublishToZeroPeers: true }) as any,
      },
    });
  }

  /**
   * Process one simulation tick
   */
  private async tick(): Promise<void> {
    if (!this.running) return;

    const now = Date.now();
    const hour = new Date().getUTCHours();

    // Check if within active hours
    const [startHour, endHour] = this.config.activeHours;
    const isActivePeriod = startHour <= endHour
      ? hour >= startHour && hour < endHour
      : hour >= startHour || hour < endHour;

    for (const [, bot] of this.bots.entries()) {
      if (!bot.active) continue;

      // Random chance to post
      if (isActivePeriod && Math.random() < 0.3) {
        await this.botPost(bot);
      }

      bot.lastActive = now;
    }
  }

  /**
   * Bot creates a post
   */
  private async botPost(bot: BotPeer): Promise<void> {
    // Generate post content based on bot's topics
    const topic = bot.topics[Math.floor(Math.random() * bot.topics.length)];
    const content = this.generatePostContent(topic);

    console.log(`[Simulator] ${bot.name} posting about ${topic}`);

    // In a real implementation, this would:
    // 1. Create a channel if needed
    // 2. Publish to gossipsub topic
    // 3. Store in DHT
    // For now, just log and track metrics

    bot.postsCreated++;
    this.metrics.postsCreated++;
  }

  /**
   * Generate post content for a topic
   */
  private generatePostContent(topic: string): string {
    const templates = [
      `Just been thinking about ${topic}...`,
      `Anyone else interested in ${topic}?`,
      `Hot take on ${topic}:`,
      `Learning more about ${topic} these days.`,
      `${topic} is fascinating!`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

/**
 * Create simulator instance
 */
export function createSimulator(config?: Partial<BotConfig>): Simulator {
  return new Simulator(config);
}
