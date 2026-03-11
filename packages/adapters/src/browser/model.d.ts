import { EmbeddingModelAdapter } from '../interfaces/model.js';
export declare class BrowserModel implements EmbeddingModelAdapter {
    private modelId;
    private isLoadedFlag;
    load(modelId: string): Promise<void>;
    embed(text: string): Promise<number[]>;
    unload(): Promise<void>;
    isLoaded(): boolean;
    getModelId(): string | null;
}
//# sourceMappingURL=model.d.ts.map