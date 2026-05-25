/* eslint-disable */
export interface EmbeddingModelAdapter {
  load(modelId: string): Promise<void>;
  embed(text: string): Promise<number[]>;
  unload(): Promise<void>;
  isLoaded(): boolean;
  getModelId(): string | null;
}
