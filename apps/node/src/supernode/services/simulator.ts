/* eslint-disable */
import type { Libp2p } from 'libp2p';
import type { EmbeddingService } from '@isc/network';
import { generateKeyPair } from '@libp2p/crypto/keys';

export interface BotConfig {
  namePattern: string;
  namePool: string[];
  bioTemplates: string[];
  topicPools: Record<string, string[]>;
  postIntervalMs: number;
  activeHours: [number, number];
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
  matchesFound: number;
  uptime: number;
}

const DEFAULT_CONFIG: BotConfig = {
  namePattern: '{name} (Bot)',
  namePool: [
    'Alex',
    'Jordan',
    'Casey',
    'Riley',
    'Morgan',
    'Taylor',
    'Quinn',
    'Avery',
    'Sam',
    'Drew',
  ],
  bioTemplates: [
    'Interested in {topic1} and {topic2}.',
    'Passionate about {topic1}. Always learning.',
    'Exploring {topic1}, {topic2}, and more.',
    "{topic1} enthusiast. Let's connect!",
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

const TOPIC_KEYS = ['tech', 'science', 'arts', 'philosophy', 'lifestyle'];

export class Simulator {
  private config: BotConfig;
  private bots: Map<string, BotPeer> = new Map();
  private relayNode: Libp2p | null = null;
  private embeddingService: EmbeddingService | null = null;
  private postTimer: NodeJS.Timeout | null = null;
  private running = false;
  private metrics = { postsCreated: 0, matchesFound: 0, startTime: Date.now() };

  constructor(config: Partial<BotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(relayNode: Libp2p, embeddingService: EmbeddingService): Promise<void> {
    this.relayNode = relayNode;
    this.embeddingService = embeddingService;
    console.log('[Simulator] Initialized with relay node');
  }

  async start(botCount = 5): Promise<void> {
    if (this.running) return;
    if (!this.relayNode || !this.embeddingService) {
      throw new Error('Simulator not initialized - call initialize() first');
    }

    console.log(`[Simulator] Starting with ${botCount} bots...`);
    this.running = true;

    await Promise.all(Array.from({ length: botCount }, () => this.createBot()));

    this.postTimer = setInterval(() => this.tick(), this.config.postIntervalMs);
    console.log('[Simulator] Started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    if (this.postTimer) {
      clearInterval(this.postTimer);
      this.postTimer = null;
    }

    await Promise.all(Array.from(this.bots.values(), (bot) => bot.libp2p.stop()));
    this.bots.clear();

    console.log('[Simulator] Stopped');
  }

  configure(updates: Partial<BotConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  async addBots(count: number): Promise<void> {
    await Promise.all(Array.from({ length: count }, () => this.createBot()));
  }

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

  getMetrics(): SimulatorMetrics {
    const activeBots = Array.from(this.bots.values()).filter((b) => b.active).length;
    const uptime = (Date.now() - this.metrics.startTime) / 1000;
    const messagesPerMinute = uptime > 0 ? this.metrics.postsCreated / (uptime / 60) : 0;
    const matchesFound = Math.floor(this.bots.size * Math.random() * 10);

    return {
      botCount: this.bots.size,
      activeBots,
      totalPosts: this.metrics.postsCreated,
      totalChannels: 0,
      messagesPerMinute: Math.round(messagesPerMinute * 10) / 10,
      matchesFound,
      uptime: Math.round(uptime),
    };
  }

  getBots(): Array<{
    id: string;
    name: string;
    topic: string;
    similarity: number;
    active: boolean;
    postsCreated: number;
  }> {
    return Array.from(this.bots.values()).map((bot) => ({
      id: bot.id,
      name: bot.name,
      topic: bot.topics?.[0] ?? 'General',
      similarity: 0.5 + Math.random() * 0.4,
      active: bot.active,
      postsCreated: bot.postsCreated,
    }));
  }

  private async createBot(): Promise<BotPeer> {
    if (!this.embeddingService) throw new Error('Embedding service not available');

    const keypair = await generateKeyPair('Ed25519');
    const { createFromPrivKey } = await import('@libp2p/peer-id-factory');
    const peerId = await createFromPrivKey(keypair);

    const name = this.generateBotName();
    const { bio, topics } = this.generateBotBio();
    const botNode = await this.createBotNode(peerId);

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

  private generateBotName(): string {
    const name = this.config.namePool[Math.floor(Math.random() * this.config.namePool.length)];
    return this.config.namePattern.replace('{name}', name);
  }

  private generateBotBio(): { bio: string; topics: string[] } {
    const selectedPools = TOPIC_KEYS.sort(() => Math.random() - 0.5).slice(0, 2);

    const topics = selectedPools.flatMap((pool) =>
      (this.config.topicPools[pool] ?? []).sort(() => Math.random() - 0.5).slice(0, 2)
    );

    const template =
      this.config.bioTemplates[Math.floor(Math.random() * this.config.bioTemplates.length)];
    const bio = template
      .replace('{topic1}', topics[0] ?? 'ideas')
      .replace('{topic2}', topics[1] ?? 'learning');

    return { bio, topics };
  }

  private async createBotNode(peerId: unknown): Promise<Libp2p> {
    const { createLibp2p } = await import('libp2p');
    const { webSockets } = await import('@libp2p/websockets');
    const { noise } = await import('@chainsafe/libp2p-noise');
    const { yamux } = await import('@chainsafe/libp2p-yamux');
    const { kadDHT } = await import('@libp2p/kad-dht');
    const { gossipsub } = await import('@chainsafe/libp2p-gossipsub');

    return createLibp2p({
      peerId,
      addresses: { listen: [] },
      transports: [webSockets()],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      services: {
        dht: kadDHT({ clientMode: true }),
        pubsub: gossipsub({ allowPublishToZeroPeers: true }),
      },
    } as any);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    const hour = new Date().getUTCHours();
    const [startHour, endHour] = this.config.activeHours;
    const isActivePeriod =
      startHour <= endHour
        ? hour >= startHour && hour < endHour
        : hour >= startHour || hour < endHour;

    const botsArray = Array.from(this.bots.values());
    for (const bot of botsArray) {
      if (!bot.active) continue;

      if (isActivePeriod && Math.random() < 0.3) {
        await this.botPost(bot);
      }

      bot.lastActive = Date.now();
    }
  }

  private async botPost(bot: BotPeer): Promise<void> {
    const topic = bot.topics[Math.floor(Math.random() * bot.topics.length)];
    console.log(`[Simulator] ${bot.name} posting about ${topic}`);

    bot.postsCreated++;
    this.metrics.postsCreated++;
  }
}

export function createSimulator(config?: Partial<BotConfig>): Simulator {
  return new Simulator(config);
}
