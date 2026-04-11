import * as webllm from '@mlc-ai/web-llm';
import { pipeline, env } from '@xenova/transformers';
import { CharacterProfile } from './SimulationAgent';

// Configure transformers.js for browser
env.allowLocalModels = false; // Need to fetch from HF hub since we are in browser
env.useBrowserCache = true;

export class LLMService {
  private engine: webllm.MLCEngine | null = null;
  private embedder: any = null;
  private isInitializing: boolean = false;
  private progressCallback: ((progress: number) => void) | null = null;
  public isTestMode: boolean = false;

  constructor() {
     // Check if we're in headless test mode (set by Playwright)
     this.isTestMode = localStorage.getItem('isc-test-mode') === 'true';
  }

  public setProgressCallback(cb: (progress: number) => void) {
    this.progressCallback = cb;
  }

  public async initialize(modelId: string = 'SmolLM2-135M-Instruct-q4f16_1-MLC') {
    if (this.engine || this.isInitializing || this.isTestMode) {
        if (this.isTestMode) {
            console.log("[LLMService] Mocking initialization for test mode");
            if (this.progressCallback) {
                for(let i=0; i<=10; i++) {
                    this.progressCallback(i / 10);
                    await new Promise(r => setTimeout(r, 100));
                }
            }
        }
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

      // Init Transformers.js Embedder
      if (this.progressCallback) this.progressCallback(0.85);
      console.log(`[LLMService] Loading Embedder...`);

      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log(`[LLMService] Successfully loaded Embedder.`);

      if (this.progressCallback) this.progressCallback(1.0);
    } catch (e) {
      console.error("[LLMService] Failed to load models", e);
    } finally {
      this.isInitializing = false;
    }
  }

  public isReady() {
    return this.isTestMode || (this.engine !== null && this.embedder !== null && !this.isInitializing);
  }

  public async getEmbedding(text: string): Promise<number[]> {
    if (this.isTestMode) {
        // Return deterministic mock embedding based on string length to allow UMAP to run somewhat meaningfully
        const val = text.length / 100.0;
        return Array(384).fill(val);
    }

    if (!this.embedder) throw new Error("Embedder not initialized");

    // We normalize the embeddings for cosine similarity
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  public async generateAgentAction(profile: CharacterProfile, observations: string[]): Promise<string> {
    if (this.isTestMode) {
        const topics = ["Wow, I love decentralization!", "Does anyone know how to configure Gossipsub?", "UMAP is such a cool algorithm.", "P2P networking is the future.", "Thinking about vector embeddings...", "What a great day for coding!"];
        return topics[Math.floor(Math.random() * topics.length)];
    }

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
