import type { Channel, Distribution } from '../types.js';
/**
 * Embedding model interface for computeRelationalDistributions
 */
export interface EmbeddingModel {
    embed(text: string): Promise<number[]>;
}
/**
 * Computes relational distributions for a channel
 */
export declare function computeRelationalDistributions(channel: Channel, model: EmbeddingModel): Promise<Distribution[]>;
//# sourceMappingURL=distributions.d.ts.map