import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import type { Stream } from '../interfaces/network.js';
import type { DelegationHealth } from '../messages.js';

export interface DelegationHealthCallback {
  (health: DelegationHealth): void;
}

export async function handleDelegationHealthStream(
  stream: Stream,
  onHealth: DelegationHealthCallback
): Promise<void> {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const parsed = JSON.parse(str);
            
            const health: DelegationHealth = {
              ...parsed,
              signature: new Uint8Array(Object.values(parsed.signature || {})),
            };
            
            if (health.type !== 'delegation_health') continue;
            onHealth(health);
          } catch (e) {
            console.warn('[DelegationHealth] Failed to parse incoming health data', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('[DelegationHealth] Error handling stream', err);
  }
}

export async function sendDelegationHealth(
  stream: Stream,
  health: DelegationHealth
): Promise<void> {
  try {
    const serialized = JSON.stringify({
      ...health,
      signature: Array.from(health.signature),
    });
    const chunk = fromString(serialized);
    const asyncIterable = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ done: false as const, value: chunk })
      })
    };
    await stream.sink(asyncIterable);
  } catch (err) {
    console.error('[DelegationHealth] Error sending health data', err);
    throw err;
  }
}

export function createDelegationHealth(
  peerID: string,
  successRate: number,
  avgLatencyMs: number,
  requestsServed24h: number,
  signature: Uint8Array
): DelegationHealth {
  return {
    type: 'delegation_health',
    peerID,
    successRate,
    avgLatencyMs,
    requestsServed24h,
    timestamp: Date.now(),
    signature,
  };
}
