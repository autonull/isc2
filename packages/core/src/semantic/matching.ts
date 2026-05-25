/* eslint-disable */
import { cosineSimilarity } from '../math/cosine.js';
import type { Distribution, Relation } from '../types.js';
import type { Location, TimeWindow } from './spatiotemporal.js';
import { locationOverlap, timeOverlap } from './spatiotemporal.js';

export interface MatchConfig {
  rootWeight: number;
  fusedWeight: number;
  tagMatchBonus: number;
  minSimilarity: number;
}

const DEFAULT_CONFIG: MatchConfig = {
  rootWeight: 1.0,
  fusedWeight: 0.8,
  tagMatchBonus: 1.2,
  minSimilarity: 0.55,
};

function parseRelationObject(object: string): Location | TimeWindow | null {
  const locationMatch = object.match(/lat:([-\d.]+),\s*long:([-\d.]+)(?:,\s*radius:(\d+)km)?/i);
  if (locationMatch) {
    return {
      lat: parseFloat(locationMatch[1]),
      lon: parseFloat(locationMatch[2]),
      radius: locationMatch[3] ? parseInt(locationMatch[3], 10) : undefined,
    };
  }

  const timeMatch = object.match(/start:([^,]+),\s*end:([^,]+)/i);
  if (timeMatch) {
    const start = new Date(timeMatch[1].trim()).getTime();
    const end = new Date(timeMatch[2].trim()).getTime();
    return !isNaN(start) && !isNaN(end) ? { start, end } : null;
  }

  return null;
}

function spatiotemporalBonus(relA: Relation, relB: Relation): number {
  if (!relA.object || !relB.object) {return 1.0;}

  const objA = parseRelationObject(relA.object);
  const objB = parseRelationObject(relB.object);

  if (!objA || !objB) {return 1.0;}

  if ('lat' in objA && 'lat' in objB) {return 1.0 + locationOverlap(objA, objB) * 0.5;}
  if ('start' in objA && 'start' in objB) {return 1.0 + timeOverlap(objA, objB) * 0.5;}

  return 1.0;
}

export function relationalMatch(
  myDists: Distribution[],
  peerDists: Distribution[],
  config: Partial<MatchConfig> = {}
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (myDists.length === 0 || peerDists.length === 0) {return 0;}

  const myRoot = myDists.find((d) => d.tag === 'root');
  const peerRoot = peerDists.find((d) => d.tag === 'root');

  let score = 0;
  let totalWeight = 0;

  if (myRoot && peerRoot) {
    const rootSim = cosineSimilarity(myRoot.mu, peerRoot.mu);
    const weightedSim = rootSim * cfg.rootWeight * (myRoot.weight ?? 1) * (peerRoot.weight ?? 1);
    score += weightedSim;
    totalWeight += cfg.rootWeight;
  }

  const myFused = myDists.filter((d) => d.tag !== 'root');
  const peerFused = peerDists.filter((d) => d.tag !== 'root');

  if (myFused.length > 0 && peerFused.length > 0) {
    const usedPeer = new Set<number>();
    let fusedScore = 0;
    let fusedWeight = 0;

    for (const myDist of myFused) {
      let bestSim = 0;
      let bestPeerIdx = -1;
      let bestBonus = 1.0;

      for (let j = 0; j < peerFused.length; j++) {
        if (usedPeer.has(j)) {continue;}

        const peerDist = peerFused[j];
        const sim = cosineSimilarity(myDist.mu, peerDist.mu);
        const bonus =
          myDist.tag && peerDist.tag && myDist.tag === peerDist.tag ? cfg.tagMatchBonus : 1.0;

        const myRel: Relation = { tag: myDist.tag || '', weight: myDist.weight };
        const peerRel: Relation = { tag: peerDist.tag || '', weight: peerDist.weight };
        const combinedBonus = bonus * spatiotemporalBonus(myRel, peerRel);

        const weightedSim = sim * combinedBonus;
        if (weightedSim > bestSim) {
          bestSim = weightedSim;
          bestPeerIdx = j;
          bestBonus = combinedBonus;
        }
      }

      if (bestPeerIdx >= 0) {
        usedPeer.add(bestPeerIdx);
        fusedScore += bestSim;
        fusedWeight += cfg.fusedWeight * bestBonus;
      }
    }

    if (fusedWeight > 0) {
      score += fusedScore;
      totalWeight += fusedWeight;
    }
  }

  if (totalWeight === 0) {return 0;}

  const normalizedScore = score / totalWeight;
  if (normalizedScore < cfg.minSimilarity) {return 0;}

  return Math.max(0, Math.min(1, normalizedScore));
}

export function distributionSimilarity(a: Distribution, b: Distribution): number {
  return cosineSimilarity(a.mu, b.mu);
}

export function rankCandidates(
  myDists: Distribution[],
  candidates: Distribution[][],
  config: Partial<MatchConfig> = {}
): Array<{ peerIndex: number; score: number }> {
  return candidates
    .map((peerDists, idx) => ({
      peerIndex: idx,
      score: relationalMatch(myDists, peerDists, config),
    }))
    .sort((a, b) => b.score - a.score);
}
