/**
 * Formats a relation for embedding
 */
function formatRelationForEmbedding(channel, relation) {
    const parts = [channel.description];
    if (relation.tag) {
        parts.push(relation.tag);
    }
    if (relation.object) {
        parts.push(relation.object);
    }
    return parts.join(' ');
}
/**
 * Computes relational distributions for a channel
 */
export async function computeRelationalDistributions(channel, model) {
    // Root distribution: embed channel description
    const rootEmbed = await model.embed(channel.description);
    const distributions = [
        {
            mu: rootEmbed,
            sigma: channel.spread || 0.1,
            weight: 1.0,
            tag: 'root',
        },
    ];
    // Fused distributions for each relation
    for (const relation of channel.relations) {
        const formattedText = formatRelationForEmbedding(channel, relation);
        const embed = await model.embed(formattedText);
        const weight = relation.weight ?? 1.0;
        distributions.push({
            mu: embed,
            sigma: (channel.spread || 0.1) / weight,
            weight: weight,
            tag: relation.tag,
        });
    }
    return distributions;
}
//# sourceMappingURL=distributions.js.map