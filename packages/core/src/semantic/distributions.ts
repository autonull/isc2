import type { Channel, Distribution, Relation } from '../types.js';

export interface EmbeddingModel {
  embed(text: string): Promise<number[]>;
}

const formatRelationForEmbedding = (channel: Channel, relation: Relation): string =>
  [channel.description, relation.tag, relation.object].filter(Boolean).join(' ');

const DEFAULT_SPREAD = 0.1;

export async function computeRelationalDistributions(
  channel: Channel,
  model: EmbeddingModel
): Promise<Distribution[]> {
  const spread = channel.spread ?? DEFAULT_SPREAD;
  const rootEmbed = await model.embed(channel.description);

  const distributions: Distribution[] = [
    { mu: rootEmbed, sigma: spread, weight: 1.0, tag: 'root' },
  ];

  for (const relation of channel.relations) {
    const embed = await model.embed(formatRelationForEmbedding(channel, relation));
    const weight = relation.weight ?? 1.0;
    distributions.push({ mu: embed, sigma: spread / weight, weight, tag: relation.tag });
  }

  return distributions;
}
