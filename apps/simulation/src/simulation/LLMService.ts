import * as webllm from '@mlc-ai/web-llm';
import { CharacterProfile } from './SimulationAgent';

export class LLMService {
  private engine: webllm.MLCEngine | null = null;
  private isInitializing: boolean = false;
  private progressCallback: ((progress: number) => void) | null = null;

  constructor() {}

  public setProgressCallback(cb: (progress: number) => void) {
    this.progressCallback = cb;
  }

  public async initialize(modelId: string = 'Llama-3.2-1B-Instruct-q4f16_1-MLC') {
    if (this.engine || this.isInitializing) return;
    this.isInitializing = true;

    try {
      this.engine = new webllm.MLCEngine();
      this.engine.setInitProgressCallback((report: webllm.InitProgressReport) => {
        if (this.progressCallback) {
          this.progressCallback(report.progress);
        }
        console.log(`[LLMService] WebLLM loading: ${report.text}`);
      });

      await this.engine.reload(modelId);
      console.log(`[LLMService] Successfully loaded model: ${modelId}`);
    } catch (e) {
      console.error("[LLMService] Failed to load model", e);
    } finally {
      this.isInitializing = false;
    }
  }

  public isReady() {
    return this.engine !== null && !this.isInitializing;
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

Based on your personality and what you observe, what are you currently thinking about? Formulate a short, single sentence expressing your thought or reaction.`;

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

      return reply.choices[0]?.message.content || "Thinking...";
    } catch (e) {
      console.error("[LLMService] Chat generation failed", e);
      return "Thinking...";
    }
  }
}
