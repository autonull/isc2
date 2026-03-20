/**
 * ISC Phase P2.4: Gossipsub Hot-Cluster Routing
 *
 * When an LSH bucket exceeds HOT_CLUSTER_THRESHOLD peers, switch from DHT put/get
 * to Gossipsub on that bucket's topic. Revert to DHT if bucket count drops below cooldown.
 */

import { getSecurityTier, HOT_CLUSTER_THRESHOLD, HOT_CLUSTER_COOLDOWN } from '@isc/core';
import { DHT_KEYS } from '../keys.js';

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

const hotBuckets = new Set<string>();

export function getHotBuckets(): Set<string> {
  return new Set(hotBuckets);
}

export function isBucketHot(bucketKey: string): boolean {
  return hotBuckets.has(bucketKey);
}

export function markBucketHot(bucketKey: string): void {
  hotBuckets.add(bucketKey);
}

export function markBucketCold(bucketKey: string): void {
  hotBuckets.delete(bucketKey);
}

export async function publishViaGossip(
  pubsub: PubsubLike,
  bucketKey: string,
  _peerId: string,
  data: Uint8Array
): Promise<void> {
  if (getSecurityTier() < 1) return;
  if (!hotBuckets.has(bucketKey)) return;

  const topic = DHT_KEYS.GOSSIP(bucketKey);
  await pubsub.publish(topic, data);
}

export function subscribeToGossip(
  pubsub: PubsubLike,
  bucketKey: string,
  handler: (peerId: string, data: Uint8Array) => void
): () => void {
  if (getSecurityTier() < 1) return () => {};

  const topic = DHT_KEYS.GOSSIP(bucketKey);
  const wrappedHandler = (event: { detail: { topic: string; data: Uint8Array } }) => {
    if (event.detail.topic !== topic) return;
    handler('', event.detail.data);
  };

  pubsub.subscribe(topic);
  pubsub.addEventListener('message', wrappedHandler);

  return () => {
    pubsub.removeEventListener('message', wrappedHandler);
    pubsub.unsubscribe(topic);
  };
}

export function countPeersInBucket(dhtPeers: string[], bucketKey: string): number {
  return dhtPeers.filter((p) => p.includes(bucketKey)).length;
}

export function updateHotBuckets(bucketCounts: Map<string, number>): void {
  for (const [bucketKey, count] of bucketCounts.entries()) {
    if (count > HOT_CLUSTER_THRESHOLD) {
      hotBuckets.add(bucketKey);
    } else if (count <= HOT_CLUSTER_COOLDOWN) {
      hotBuckets.delete(bucketKey);
    }
  }
}

export function clearHotBuckets(): void {
  hotBuckets.clear();
}

export function getGossipTopic(bucketKey: string): string {
  return DHT_KEYS.GOSSIP(bucketKey);
}
