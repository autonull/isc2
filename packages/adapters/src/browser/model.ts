import { EmbeddingModelAdapter } from '../interfaces/model.js';

const EMBEDDING_DIM = 384;

export class BrowserModel implements EmbeddingModelAdapter {
  private modelId: string | null = null;
  private isLoadedFlag = false;

  async load(modelId: string): Promise<void> {
    this.modelId = modelId;
    this.isLoadedFlag = true;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isLoadedFlag) throw new Error('Model not loaded');

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }

    const seed = Math.abs(hash);
    const random = () => {
      const x = Math.sin(seed * 9999) * 10000;
      return x - Math.floor(x);
    };

    const mockEmbed = Array.from(
      { length: EMBEDDING_DIM },
      (_, i) => random() * 2 - 1 + Math.sin(i * 0.1) * 0.3
    );
    const norm = Math.sqrt(mockEmbed.reduce((sum, x) => sum + x * x, 0));
    return mockEmbed.map((x) => x / norm);
  }

  async unload(): Promise<void> {
    this.isLoadedFlag = false;
    this.modelId = null;
  }
  isLoaded(): boolean {
    return this.isLoadedFlag;
  }
  getModelId(): string | null {
    return this.modelId;
  }
}
