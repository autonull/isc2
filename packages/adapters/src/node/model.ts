import { EmbeddingModelAdapter } from '../interfaces/model.js';

interface NodeModelOptions {
  maxBatchSize?: number;
}

export class NodeModel implements EmbeddingModelAdapter {
  private modelId: string | null = null;
  private isLoadedFlag = false;
  private session: any = null;
  private options: Required<NodeModelOptions>;

  constructor(options: NodeModelOptions = {}) {
    this.options = {
      maxBatchSize: options.maxBatchSize ?? 32,
    };
  }

  async load(modelId: string): Promise<void> {
    this.modelId = modelId;

    const ort = await import('onnxruntime-node');
    this.session = await ort.InferenceSession.create(modelId);
    this.isLoadedFlag = true;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isLoadedFlag || !this.session) {
      throw new Error('Model not loaded');
    }

    const tokens = this.tokenize(text);
    const inputTensor = this.tokensToTensor(tokens);

    const feeds: Record<string, any> = {};
    feeds[this.session.inputNames[0]] = inputTensor;

    const results = await this.session.run(feeds);
    const outputTensor = results[this.session.outputNames[0]];

    const embedding = Array.from(outputTensor.data as Float32Array).slice(0, 384);
    return this.normalize(embedding);
  }

  async unload(): Promise<void> {
    this.isLoadedFlag = false;
    this.session = null;
    this.modelId = null;
  }

  isLoaded(): boolean {
    return this.isLoadedFlag;
  }

  getModelId(): string | null {
    return this.modelId;
  }

  private tokenize(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const maxTokens = 512;
    const tokens = words.slice(0, maxTokens);
    return tokens.map((w) => this.hashToId(w));
  }

  private hashToId(word: string): number {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 10000;
  }

  private tokensToTensor(tokens: number[]): any {
    const ort = require('onnxruntime-node');
    const tensorData = new Float32Array(tokens.length + 1);
    tensorData[0] = tokens.length;
    tokens.forEach((t, i) => (tensorData[i + 1] = t));

    return new ort.InferenceSession.Tensor({
      data: tensorData,
      dims: [1, tokens.length + 1],
      type: 'int64',
    });
  }

  private normalize(embedding: number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    return norm > 0 ? embedding.map((x) => x / norm) : embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += this.options.maxBatchSize) {
      batches.push(texts.slice(i, i + this.options.maxBatchSize));
    }

    const results: number[][] = [];
    for (const batch of batches) {
      for (const text of batch) {
        results.push(await this.embed(text));
      }
    }

    return results;
  }
}

export const nodeModel = new NodeModel();
