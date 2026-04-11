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
  public tickInterval: number = 8000; // Increased default to give LLM time and avoid congestion
  private timer: any = null;
  private llm: LLMService | null = null;

  // The global simulated network of thoughts with their embeddings
  public dhtNetwork: DHTPost[] = [];

  // Track successful visual "hears" (edges) for the UI map
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

  // Cosine similarity helper
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

    // Clean up old visual edges
    const now = Date.now();
    this.recentEdges = this.recentEdges.filter(e => now - e.time < 5000);

    // Pick agent
    const agent = this.agents[Math.floor(Math.random() * this.agents.length)];
    agent.currentTopic = "Thinking...";

    // Semantic Filtering: The agent only "observes" recent thoughts that are somewhat semantically related to its bio/interests
    let observations: string[] = [];

    // Compute agent's "core" embedding based on their bio (cached if possible, but calculating here for simplicity)
    const agentProfileText = agent.profile.bio + " " + agent.profile.interests.join(" ");
    const agentProfileEmb = await this.llm.getEmbedding(agentProfileText);

    // Filter the network for recent, relevant posts
    const recentNetwork = this.dhtNetwork.slice(-10).filter(p => p.peerId !== agent.peerId);

    for (const post of recentNetwork) {
        const similarity = this.cosineSimilarity(agentProfileEmb, post.embedding);

        // If similarity is > 0.15 (arbitrary threshold for this simulation), the agent "hears" it
        if (similarity > 0.15) {
            observations.push(`Another Peer said: "${post.topic}" (similarity: ${similarity.toFixed(2)})`);

            // Record the connection for the UI map visualization
            this.recentEdges.push({
                from: post.peerId,
                to: agent.peerId,
                time: now
            });
        }
    }

    // Generate new thought
    const thought = await this.llm.generateAgentAction(agent.profile, observations);
    agent.currentTopic = thought;

    // Calculate embedding for the new thought
    const thoughtEmb = await this.llm.getEmbedding(thought);

    // Add to DHT
    this.dhtNetwork.push({
        peerId: agent.peerId,
        topic: thought,
        timestamp: now,
        embedding: thoughtEmb
    });

    // Keep DHT somewhat bounded
    if (this.dhtNetwork.length > 50) {
        this.dhtNetwork.shift();
    }

    console.log(`[SimulationEngine] Agent ${agent.profile.name} thought: ${thought}`);
  }
}
