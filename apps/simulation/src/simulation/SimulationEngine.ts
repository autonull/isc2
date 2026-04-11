import { SimulationAgent, CharacterProfile } from './SimulationAgent';
import { LLMService } from './LLMService';

export class SimulationEngine {
  public agents: SimulationAgent[] = [];
  public isRunning: boolean = false;
  public tickInterval: number = 5000;
  private timer: any = null;
  private llm: LLMService | null = null;
  public dhtNetwork: any[] = []; // A simple in-memory mock of the DHT/Channel network for now.

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

  private async tick() {
    if (!this.llm || !this.llm.isReady()) {
      console.log("[SimulationEngine] Skipping tick, LLM not ready.");
      return;
    }

    // Randomly pick an agent to take an action this tick (to avoid parallel generation crashes/overload on WebLLM)
    const agent = this.agents[Math.floor(Math.random() * this.agents.length)];

    // Construct observations from DHT (last 3 thoughts)
    const observations = this.dhtNetwork.slice(-3).map(p => `Peer: "${p.topic}"`);

    console.log(`[SimulationEngine] Agent ${agent.profile.name} is thinking...`);
    agent.currentTopic = "Thinking...";

    // In a real app we would use transformers.js to compute embedding.
    const thought = await this.llm.generateAgentAction(agent.profile, observations);
    agent.currentTopic = thought;

    // Add to DHT
    this.dhtNetwork.push({
        peerId: agent.peerId,
        topic: thought,
        timestamp: Date.now()
    });

    console.log(`[SimulationEngine] Agent ${agent.profile.name} thought: ${thought}`);
  }
}
