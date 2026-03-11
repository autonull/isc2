import type { EmbedRequest, EmbedResponse } from './types.js';
import { validateEmbedRequest, serializeServiceResponse } from './types.js';

export class EmbedService {
  private modelAdapter: EmbedModelAdapter;
  private supportedModel: string;

  constructor(modelAdapter: EmbedModelAdapter, supportedModel: string) {
    this.modelAdapter = modelAdapter;
    this.supportedModel = supportedModel;
  }

  async handleRequest(payload: Uint8Array): Promise<Uint8Array> {
    const decoder = new TextDecoder();
    const req: EmbedRequest = JSON.parse(decoder.decode(payload));

    if (!validateEmbedRequest(req)) {
      throw new Error('Invalid embed request');
    }

    if (req.model !== this.supportedModel) {
      throw new Error(`Model mismatch: expected ${this.supportedModel}, got ${req.model}`);
    }

    await this.modelAdapter.load(req.model);
    const embedding = await this.modelAdapter.embed(req.text);

    const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));

    const response: EmbedResponse = {
      embedding,
      model: req.model,
      norm,
    };

    return serializeServiceResponse('embed', response);
  }

  isAvailable(): boolean {
    return this.modelAdapter.isLoaded();
  }
}

export interface EmbedModelAdapter {
  load(modelId: string): Promise<void>;
  embed(text: string): Promise<number[]>;
  unload(): Promise<void>;
  isLoaded(): boolean;
  getModelId(): string | null;
}
