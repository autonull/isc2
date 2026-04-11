import { SimulationAgent, CharacterProfile } from './SimulationAgent';
import { LLMService } from './LLMService';
import { UMAP } from 'umap-js';
import { LocalNetworkMedium } from '@isc/adapters';

export interface DHTPost {
    peerId: string;
    topic: string;
    timestamp: number;
    embedding: number[];
}

export class SimulationEngine {
  public agents: SimulationAgent[] = [];
  public isRunning: boolean = false;
  // Decrease default interval for punchier out of the box experience
  public tickInterval: number = 4000;
  private timer: any = null;
  private llm: LLMService | null = null;
  public networkMedium: LocalNetworkMedium;

  public dhtNetwork: DHTPost[] = [];
  public recentEdges: { from: string, to: string, time: number }[] = [];
  public agentPositions: Map<string, { x: number, y: number }> = new Map();
  public umapChance: number = 0.2;

  constructor() {
      this.networkMedium = new LocalNetworkMedium();
  }

  public setLLM(llm: LLMService) {
    this.llm = llm;
  }

  public addAgent(profile: CharacterProfile) {
    const agent = new SimulationAgent(profile);

    // Attach to real local network
    const adapter = this.networkMedium.createPeer(agent.peerId);
    agent.attachNetwork(adapter);

    this.agents.push(agent);

    // Initial random position if embeddings aren't ready
    this.agentPositions.set(agent.peerId, {
       x: 0.3 + Math.random() * 0.6,
       y: 0.1 + Math.random() * 0.8
    });
    return agent;
  }

  public removeAgent(peerId: string) {
    this.agents = this.agents.filter(a => a.peerId !== peerId);
    this.agentPositions.delete(peerId);
  }

  public setTickInterval(ms: number) {
    this.tickInterval = ms;
    if (this.isRunning) {
      this.pause();
      this.start();
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Fire immediately then interval
    this.tick();
    this.timer = setInterval(() => this.tick(), this.tickInterval);
    console.log("[SimulationEngine] Started.");
  }

  public pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[SimulationEngine] Paused.");
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async updateUMAPPositions() {
    if (this.agents.length < 2) return; // Need at least 2 for UMAP to make sense (or more)
    if (!this.llm || !this.llm.isReady()) return;

    try {
       const embeddings: number[][] = [];
       const ids: string[] = [];

       for (const agent of this.agents) {
          const agentProfileText = agent.profile.bio + " " + agent.profile.interests.join(" ");
          const emb = await this.llm.getEmbedding(agentProfileText);
          embeddings.push(emb);
          ids.push(agent.peerId);
       }

       // if we have less than n_neighbors, UMAP throws an error. UMAP n_neighbors default is 15.
       // So we configure it explicitly based on agents count.
       const nNeighbors = Math.max(2, Math.min(15, this.agents.length - 1));

       if (embeddings.length >= 2) {
           const umap = new UMAP({
               nComponents: 2,
               nNeighbors,
               minDist: 0.1
           });
           const projection = umap.fit(embeddings);

           // Normalize projection to 0.0 - 1.0, keeping right of the sidebar (0.35 - 0.9) and vertical (0.1 - 0.9)
           let minX = Infinity, maxX = -Infinity;
           let minY = Infinity, maxY = -Infinity;

           projection.forEach(p => {
               if (p[0] < minX) minX = p[0];
               if (p[0] > maxX) maxX = p[0];
               if (p[1] < minY) minY = p[1];
               if (p[1] > maxY) maxY = p[1];
           });

           const rangeX = maxX - minX || 1;
           const rangeY = maxY - minY || 1;

           projection.forEach((p, i) => {
               const normalizedX = 0.35 + ((p[0] - minX) / rangeX) * 0.55;
               const normalizedY = 0.1 + ((p[1] - minY) / rangeY) * 0.8;

               this.agentPositions.set(ids[i], {
                   x: normalizedX,
                   y: normalizedY
               });
           });
       }

    } catch (e) {
       console.error("[SimulationEngine] Error computing UMAP:", e);
    }
  }

  public forceUpdatePositions() {
     this.updateUMAPPositions();
  }

  private async tick() {
    if (!this.llm || !this.llm.isReady()) {
      console.log("[SimulationEngine] Skipping tick, LLM not ready.");
      return;
    }

    const now = Date.now();
    this.recentEdges = this.recentEdges.filter(e => now - e.time < 5000);

    const agent = this.agents[Math.floor(Math.random() * this.agents.length)];
    agent.currentTopic = "Thinking...";

    let observations: string[] = [];

    try {
        // Collect real observations from PubSub and filter by similarity
        const agentProfileText = agent.profile.bio + " " + agent.profile.interests.join(" ");
        const agentProfileEmb = await this.llm.getEmbedding(agentProfileText);

        // Agents look at messages they recently received via PubSub
        const recentMessages = [...agent.recentMessages].filter(p => p.peerId !== agent.peerId);

        for (const post of recentMessages) {
            const postEmb = await this.llm.getEmbedding(post.message);
            let similarity = this.cosineSimilarity(agentProfileEmb, postEmb);

            if (similarity > 0.15) {
                observations.push(`In channel #${post.topic}, another peer said: "${post.message}" (similarity: ${similarity.toFixed(2)})`);

                this.recentEdges.push({
                    from: post.peerId,
                    to: agent.peerId,
                    time: now
                });
            }
        }

        // Also do a quick DHT scan just for additional "global" flavor
        const dhtEntries = await agent.networkAdapter!.query('global_feed', 5);
        for (const entry of dhtEntries) {
            try {
                const dhtPost = JSON.parse(new TextDecoder().decode(entry));
                if (dhtPost.peerId !== agent.peerId && !recentMessages.find(m => m.message === dhtPost.message)) {
                    observations.push(`On the global feed, another peer said: "${dhtPost.message}"`);
                }
            } catch (e) {}
        }

        const thought = await this.llm.generateAgentAction(agent.profile, observations);
        agent.currentTopic = thought;

        const thoughtEmb = await this.llm.getEmbedding(thought);

        // Determine channel to publish to based on agent interests (simple heuristic for now)
        const channelTopic = agent.profile.interests.length > 0 ? agent.profile.interests[0] : "general";

        // Publish over real LocalNetworkAdapter
        const payload = new TextEncoder().encode(JSON.stringify({
            peerId: agent.peerId,
            message: thought,
            timestamp: now
        }));

        await agent.networkAdapter!.publish(channelTopic, payload);
        await agent.networkAdapter!.announce('global_feed', payload, 300000);

        // Keep local visualization synced (optional but good for dashboard)
        this.dhtNetwork.push({
            peerId: agent.peerId,
            topic: thought,
            timestamp: now,
            embedding: thoughtEmb
        });

        if (this.dhtNetwork.length > 50) {
            this.dhtNetwork.shift();
        }

        console.log(`[SimulationEngine] Agent ${agent.profile.name} published to #${channelTopic}: ${thought}`);

        // Occasional chance to listen to a new interesting topic
        if (Math.random() < 0.2 && observations.length > 0) {
            const potentialNewTopics = this.dhtNetwork.slice(-5).map(p => p.topic).filter(t => t.split(' ').length === 1);
            if (potentialNewTopics.length > 0) {
                const newTopic = potentialNewTopics[Math.floor(Math.random() * potentialNewTopics.length)];
                agent.subscribeToTopic(newTopic);
            }
        }

        // Occasionally update positions based on embeddings
        if (Math.random() < this.umapChance) {
            this.updateUMAPPositions();
        }
    } catch (e) {
        console.error("[SimulationEngine] Error during tick computation:", e);
        agent.currentTopic = "Oops, an error occurred while thinking.";
    }
  }
}
