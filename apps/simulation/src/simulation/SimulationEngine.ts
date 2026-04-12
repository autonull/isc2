import { SimulationAgent, CharacterProfile } from './SimulationAgent';
import { LLMService } from './LLMService';
import { UMAP } from 'umap-js';
import { LocalNetworkMedium } from '@isc/adapters';
import { computeRelationalDistributions, distributionSimilarity, type Channel } from '@isc/core';

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

  // Maps peerId (agent) or channelId to {x,y} positions
  public agentPositions: Map<string, { x: number, y: number }> = new Map();
  public channelPositions: Map<string, { x: number, y: number }> = new Map();

  public umapChance: number = 0.2;
  private channelEmbeddings: Map<string, number[]> = new Map();

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

    // We update distributions async if LLM is ready
    if (this.llm && this.llm.isReady()) {
       this.updateAgentDistributions(agent).catch(console.error);
    }
    return agent;
  }

  private async updateAgentDistributions(agent: SimulationAgent) {
      if (!this.llm || !this.llm.isReady()) return;

      const pseudoChannel: Channel = {
          id: agent.peerId,
          name: agent.profile.name,
          description: agent.profile.bio,
          spread: 0.1,
          relations: agent.profile.interests.map(interest => ({ tag: 'interest', object: interest, weight: 1.0 })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          active: true
      };

      agent.distributions = await computeRelationalDistributions(pseudoChannel, {
          embed: async (text: string) => await this.llm!.getEmbedding(text)
      });
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

  private async updateUMAPPositions() {
    if (!this.llm || !this.llm.isReady()) return;

    try {
       const embeddings: number[][] = [];
       const ids: string[] = []; // Stores either peerId or channel topic
       const isAgentList: boolean[] = [];

       // Gather ALL distinct channels from all agents subscriptions
       const activeChannels = new Set<string>();
       for (const agent of this.agents) {
           agent.subscribedTopics.forEach(t => activeChannels.add(t));
       }

       // Process Channel Embeddings first
       for (const channel of activeChannels) {
           if (!this.channelEmbeddings.has(channel)) {
               // The embedding of a channel is just the embedding of its topic word
               const emb = await this.llm.getEmbedding(channel);
               this.channelEmbeddings.set(channel, emb);
           }
           embeddings.push(this.channelEmbeddings.get(channel)!);
           ids.push(channel);
           isAgentList.push(false);
       }

       // Process Agent Embeddings: they sit at the average of their subscriptions
       for (const agent of this.agents) {
          let agentEmb: number[];
          if (agent.subscribedTopics.size > 0) {
              const subbedEmbeddings = Array.from(agent.subscribedTopics).map(t => this.channelEmbeddings.get(t)).filter(Boolean) as number[][];
              if (subbedEmbeddings.length > 0) {
                  // Calculate mean vector
                  agentEmb = new Array(subbedEmbeddings[0].length).fill(0);
                  for (const emb of subbedEmbeddings) {
                      for (let i = 0; i < emb.length; i++) {
                          agentEmb[i] += emb[i];
                      }
                  }
                  for (let i = 0; i < agentEmb.length; i++) {
                      agentEmb[i] /= subbedEmbeddings.length;
                  }
                  // Normalize
                  let norm = Math.sqrt(agentEmb.reduce((acc, v) => acc + v*v, 0));
                  if (norm > 0) {
                      agentEmb = agentEmb.map(v => v / norm);
                  }
              } else {
                  const agentProfileText = agent.profile.bio + " " + agent.profile.interests.join(" ");
                  agentEmb = await this.llm.getEmbedding(agentProfileText);
              }
          } else {
              const agentProfileText = agent.profile.bio + " " + agent.profile.interests.join(" ");
              agentEmb = await this.llm.getEmbedding(agentProfileText);
          }

          embeddings.push(agentEmb);
          ids.push(agent.peerId);
          isAgentList.push(true);
       }

       const totalItems = embeddings.length;
       if (totalItems < 2) return;

       const nNeighbors = Math.max(2, Math.min(15, totalItems - 1));

       if (embeddings.length >= 2) {
           const umap = new UMAP({
               nComponents: 2,
               nNeighbors,
               minDist: 0.1
           });
           const projection = umap.fit(embeddings);

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

               if (isAgentList[i]) {
                   this.agentPositions.set(ids[i], { x: normalizedX, y: normalizedY });
               } else {
                   this.channelPositions.set(ids[i], { x: normalizedX, y: normalizedY });
               }
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
        // Make sure agent distributions are initialized
        if (!agent.distributions || agent.distributions.length === 0) {
            await this.updateAgentDistributions(agent);
        }

        // Collect real observations from PubSub and filter by similarity
        // Agents look at messages they recently received via PubSub
        const recentMessages = [...agent.recentMessages].filter(p => p.peerId !== agent.peerId);

        if (agent.distributions && agent.distributions.length > 0) {
            const rootDist = agent.distributions.find(d => d.tag === 'root') || agent.distributions[0];

            for (const post of recentMessages) {
                const postEmb = await this.llm.getEmbedding(post.message);
                const postDist = { mu: postEmb, sigma: 0.1, weight: 1.0, tag: 'root' };

                let similarity = distributionSimilarity(rootDist, postDist);

                if (similarity > 0.15) {
                    observations.push(`In channel #${post.topic}, another peer said: "${post.message}" (similarity: ${similarity.toFixed(2)})`);

                    this.recentEdges.push({
                        from: post.peerId,
                        to: agent.peerId,
                        time: now
                    });
                }
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

        // Extract a hashtag or use a random interest from another agent on the network to discover a new topic
        if (Math.random() < 0.2 && observations.length > 0) {
            const otherAgents = this.agents.filter(a => a.peerId !== agent.peerId);
            if (otherAgents.length > 0) {
                const randomOther = otherAgents[Math.floor(Math.random() * otherAgents.length)];
                if (randomOther.profile.interests.length > 0) {
                    const newTopic = randomOther.profile.interests[Math.floor(Math.random() * randomOther.profile.interests.length)];
                    agent.subscribeToTopic(newTopic);
                }
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
