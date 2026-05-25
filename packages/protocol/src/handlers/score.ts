/* eslint-disable */
/**
 * ISC Phase P2.2: Peer Scoring via /isc/score/1.0
 *
 * Broadcasts ScoreDelta via Gossipsub and maintains a local reputation cache.
 * Reputation affects query result ordering and quota allocation.
 */

import type { ScoreDelta } from '../messages.js';
import type { Libp2p } from 'libp2p';
import { getSecurityTier, MIN_REP_FOR_FULL_QUOTA, REP_DECAY_PER_DAY } from '@isc/core';
import { PROTOCOL_SCORE } from '../constants.js';

interface PubsubLike {
  publish(topic: string, data: Uint8Array): Promise<void>;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  addEventListener(
    event: string,
    handler: (event: { detail: { topic: string; data: Uint8Array } }) => void
  ): void;
  removeEventListener(
    event: string,
    handler: (event: { detail: { topic: string; data: Uint8Array } }) => void
  ): void;
}

export interface ReputationScore {
  score: number;
  lastUpdated: number;
  deltas: { delta: number; reason: string; ts: number }[];
}

export interface ScoreServiceConfig {
  onScoreUpdate?: (peerId: string, newScore: number) => void;
  onLowRepPeer?: (peerId: string) => void;
}

const SCORE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const scoreCache = new Map<string, ReputationScore>();
const scoreConfigMap = new Map<string, ScoreServiceConfig>();
let scoreTopic = '';

export function getReputation(peerId: string): number {
  const entry = scoreCache.get(peerId);
  if (!entry) {return 0;}
  if (Date.now() - entry.lastUpdated > SCORE_CACHE_TTL_MS) {
    scoreCache.delete(peerId);
    return 0;
  }
  return entry.score;
}

export function getReputationWithDecay(peerId: string): number {
  const entry = scoreCache.get(peerId);
  if (!entry) {return 0;}
  if (Date.now() - entry.lastUpdated > SCORE_CACHE_TTL_MS) {
    scoreCache.delete(peerId);
    return 0;
  }
  const daysSinceUpdate = (Date.now() - entry.lastUpdated) / (24 * 60 * 60 * 1000);
  return Math.max(0, entry.score - daysSinceUpdate * REP_DECAY_PER_DAY * entry.score);
}

export function getQuotaMultiplier(peerId: string): number {
  const rep = getReputationWithDecay(peerId);
  if (rep >= MIN_REP_FOR_FULL_QUOTA) {return 2.0;}
  if (rep >= 50) {return 1.0;}
  if (rep > 0) {return 0.5;}
  return 0.25;
}

export function initializeScoreService(
  node: Libp2p,
  pubsub: PubsubLike,
  peerId: string,
  config?: ScoreServiceConfig
): void {
  if (getSecurityTier() < 1) {return;}

  if (config) {scoreConfigMap.set(peerId, config);}
  scoreTopic = `${PROTOCOL_SCORE}/${peerId}`;

  void node.handle([PROTOCOL_SCORE], ({ stream }) => {
    void (async () => {
      try {
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream.source) {
          chunks.push(Uint8Array.from(chunk instanceof Uint8Array ? chunk : chunk.subarray()));
        }
        if (chunks.length === 0) {return;}
        const delta = JSON.parse(new TextDecoder().decode(chunks[0])) as ScoreDelta;
        applyScoreDelta(delta);
      } catch (err) {
        console.debug('[Score] Handler error:', err);
      }
    })();
  });

  const handler = (event: { detail: { topic: string; data: Uint8Array } }) => {
    if (!event.detail.topic.includes('score')) {return;}
    try {
      const delta = JSON.parse(new TextDecoder().decode(event.detail.data)) as ScoreDelta;
      applyScoreDelta(delta);
    } catch (err) {
      console.debug('[Score] Pubsub parse error:', err);
    }
  };

  pubsub.addEventListener('message', handler);
  pubsub.subscribe(scoreTopic);
}

function applyScoreDelta(delta: ScoreDelta): void {
  if (delta.delta === 0) {return;}

  let entry = scoreCache.get(delta.subjectID);
  if (!entry) {
    entry = { score: 0, lastUpdated: Date.now(), deltas: [] };
    scoreCache.set(delta.subjectID, entry);
  }

  entry.score = Math.max(0, entry.score + delta.delta);
  entry.lastUpdated = Date.now();
  entry.deltas.push({ delta: delta.delta, reason: delta.reason, ts: delta.timestamp });

  if (entry.deltas.length > 100) {
    entry.deltas = entry.deltas.slice(-50);
  }

  for (const config of scoreConfigMap.values()) {
    config.onScoreUpdate?.(delta.subjectID, entry.score);
    if (entry.score < 50) {config.onLowRepPeer?.(delta.subjectID);}
  }
}

export async function broadcastScoreDelta(
  pubsub: PubsubLike,
  subjectID: string,
  delta: number,
  reason: string
): Promise<void> {
  if (getSecurityTier() < 1) {return;}
  if (!scoreTopic) {return;}

  const scoreDelta: ScoreDelta = {
    type: 'score_delta',
    subjectID,
    delta,
    reason,
    timestamp: Date.now(),
  };

  await pubsub.publish(scoreTopic, new TextEncoder().encode(JSON.stringify(scoreDelta)));
}

export function getAllReputations(): Map<string, number> {
  const result = new Map<string, number>();
  for (const [peerId, entry] of scoreCache.entries()) {
    if (Date.now() - entry.lastUpdated <= SCORE_CACHE_TTL_MS) {
      result.set(peerId, entry.score);
    }
  }
  return result;
}

export function filterByReputation(
  candidates: string[],
  minRep = 0,
  _quotaMultiplier = 1.0
): string[] {
  return candidates.filter((peerId) => {
    const rep = getReputationWithDecay(peerId);
    return rep >= minRep;
  });
}

export function shutdownScoreService(pubsub: PubsubLike): void {
  if (scoreTopic) {
    pubsub.unsubscribe(scoreTopic);
  }
  scoreCache.clear();
  scoreConfigMap.clear();
}
