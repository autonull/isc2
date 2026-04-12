import * as webllm from '@mlc-ai/web-llm';
import { BrowserModel } from '@isc/adapters';
import { CharacterProfile } from './SimulationAgent';

export class LLMService {
  private engine: webllm.MLCEngine | null = null;
  private embedder: BrowserModel | null = null;
  private isInitializing: boolean = false;
  private progressCallback: ((progress: number) => void) | null = null;

  constructor() {}

  public setProgressCallback(cb: (progress: number) => void) {
    this.progressCallback = cb;
  }

  public async initialize(modelId: string = 'SmolLM2-135M-Instruct-q4f16_1-MLC') {
    if (this.engine || this.isInitializing) {
        return;
    }

    this.isInitializing = true;

    try {
      // Init WebLLM
      this.engine = new webllm.MLCEngine();
      this.engine.setInitProgressCallback((report: webllm.InitProgressReport) => {
        if (this.progressCallback) {
          // Weight WebLLM as 80% of the progress
          this.progressCallback(report.progress * 0.8);
        }
        console.log(`[LLMService] WebLLM loading: ${report.text}`);
      });

      await this.engine.reload(modelId);
      console.log(`[LLMService] Successfully loaded WebLLM model: ${modelId}`);

      // Init BrowserModel Embedder (Shared with Web UI)
      if (this.progressCallback) this.progressCallback(0.85);
      console.log(`[LLMService] Loading Embedder...`);

      this.embedder = new BrowserModel();
      await this.embedder.load('Xenova/all-MiniLM-L6-v2');
      console.log(`[LLMService] Successfully loaded Embedder.`);

      if (this.progressCallback) this.progressCallback(1.0);
    } catch (e) {
      console.error("[LLMService] Failed to load models", e);
    } finally {
      this.isInitializing = false;
    }
  }

  public isReady() {
    return this.engine !== null && this.embedder !== null && !this.isInitializing;
  }

  public async getEmbedding(text: string): Promise<number[]> {
    if (!this.embedder || !this.embedder.isLoaded()) {
      throw new Error("Embedder not initialized");
    }

    // BrowserModel handles normalization automatically
    return await this.embedder.embed(text);
  }

  public async generateAgentAction(profile: CharacterProfile, observations: string[]): Promise<string> {
    if (!this.engine) {
      return "Thinking...";
    }

    const systemPrompt = `You are a simulated character interacting in a decentralized semantic space.
Your name is ${profile.name}.
Your biography/persona: ${profile.bio}
Your interests: ${profile.interests.join(", ")}

You are observing the following thoughts from other peers in the space:
${observations.length > 0 ? observations.map(o => `- ${o}`).join("\n") : "- It is quiet right now."}

Based on your personality and what you observe, what are you currently thinking about? Formulate a short, single sentence expressing your thought or reaction. Do not use quotes or prefixes, just the thought itself.`;

    try {
      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "What is your current thought?" }
      ];

      const reply = await this.engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 50,
      });

      return reply.choices[0]?.message.content?.trim() || "Thinking...";
    } catch (e) {
      console.error("[LLMService] Chat generation failed", e);
      return "Thinking...";
    }
  }
}
