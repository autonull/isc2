import { SimulationAgent, CharacterProfile } from './SimulationAgent';
import { LLMService } from './LLMService';

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

  constructor() {}

  public setLLM(llm: LLMService) {
    this.llm = llm;
  }

  public addAgent(profile: CharacterProfile) {
    const agent = new SimulationAgent(profile);
    this.agents.push(agent);
    return agent;
  }

  public removeAgent(peerId: string) {
    this.agents = this.agents.filter(a => a.peerId !== peerId);
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
    } catch (e) {
        console.error("[SimulationEngine] Error during tick computation:", e);
        agent.currentTopic = "Oops, an error occurred while thinking.";
    }
  }
}
