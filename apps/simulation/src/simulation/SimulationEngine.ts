import { SimulationAgent, CharacterProfile } from './SimulationAgent';
import { LLMService } from './LLMService';
import { UMAP } from 'umap-js';

export interface DHTPost {
    peerId: string;
    topic: string;
    timestamp: number;
    embedding: number[];
}

export class SimulationEngine {
  public agents: SimulationAgent[] = [];
  public isRunning: boolean = false;
  public tickInterval: number = 8000;
  private timer: any = null;
  private llm: LLMService | null = null;

  public dhtNetwork: DHTPost[] = [];
  public recentEdges: { from: string, to: string, time: number }[] = [];
  public agentPositions: Map<string, { x: number, y: number }> = new Map();
  public umapChance: number = 0.2;

  constructor() {}

  public setLLM(llm: LLMService) {
    this.llm = llm;
  }

  public addAgent(profile: CharacterProfile) {
    const agent = new SimulationAgent(profile);
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
        const agentProfileText = agent.profile.bio + " " + agent.profile.interests.join(" ");
        const agentProfileEmb = await this.llm.getEmbedding(agentProfileText);

        const recentNetwork = this.dhtNetwork.slice(-10).filter(p => p.peerId !== agent.peerId);

        for (const post of recentNetwork) {
            const similarity = this.cosineSimilarity(agentProfileEmb, post.embedding);

            if (similarity > 0.15) {
                observations.push(`Another Peer said: "${post.topic}" (similarity: ${similarity.toFixed(2)})`);

                this.recentEdges.push({
                    from: post.peerId,
                    to: agent.peerId,
                    time: now
                });
            }
        }

        const thought = await this.llm.generateAgentAction(agent.profile, observations);
        agent.currentTopic = thought;

        const thoughtEmb = await this.llm.getEmbedding(thought);

        this.dhtNetwork.push({
            peerId: agent.peerId,
            topic: thought,
            timestamp: now,
            embedding: thoughtEmb
        });

        if (this.dhtNetwork.length > 50) {
            this.dhtNetwork.shift();
        }

        console.log(`[SimulationEngine] Agent ${agent.profile.name} thought: ${thought}`);

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
