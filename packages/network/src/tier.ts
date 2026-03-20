/**
 * ISC Phase P0: Tier Negotiation Handler
 *
 * Implements /isc/tier/1.0 protocol for security tier discovery.
 * Peers exchange tier information on connect and reject mismatched connections.
 */

import type { Libp2p } from 'libp2p';
import type { TierIdentifyPush } from '@isc/protocol';
import { PROTOCOL_TIER } from '@isc/protocol';

export interface TierNegotiationConfig {
  onMismatch?: (localTier: number, remoteTier: number, remotePeerId: string) => void;
  onMatch?: (tier: number, networkID: string, remotePeerId: string) => void;
}

export interface PeerTierInfo {
  tier: number;
  networkID: string;
  ts: number;
}

const peerTiers = new Map<string, PeerTierInfo>();

export function getPeerTier(peerId: string): PeerTierInfo | undefined {
  const info = peerTiers.get(peerId);
  if (!info) return undefined;
  if (Date.now() - info.ts > 5 * 60 * 1000) {
    peerTiers.delete(peerId);
    return undefined;
  }
  return info;
}

export function registerTierNegotiation(
  node: Libp2p,
  getSecurityTier: () => number,
  getNetworkID: () => string,
  config?: TierNegotiationConfig
): void {
  node.handle([PROTOCOL_TIER], async ({ stream, connection }) => {
    try {
      const remotePeerId = connection.remotePeer.toString();
      const localTier = getSecurityTier();
      const localNetworkID = getNetworkID();

      const push: TierIdentifyPush = {
        v: 2,
        tier: localTier as 0 | 1 | 2,
        peerID: node.peerId.toString(),
        ts: Date.now(),
        type: 'tier_identify',
        networkID: localNetworkID,
      };

      const encoded = new TextEncoder().encode(JSON.stringify(push));
      await stream.sink([encoded]);

      const chunks: Uint8Array[] = [];
      for await (const chunk of stream.source) {
        chunks.push(Uint8Array.from(chunk instanceof Uint8Array ? chunk : chunk.subarray()));
      }

      if (chunks.length > 0) {
        const response = JSON.parse(new TextDecoder().decode(chunks[0])) as TierIdentifyPush;
        peerTiers.set(remotePeerId, {
          tier: response.tier,
          networkID: response.networkID,
          ts: Date.now(),
        });

        if (response.tier !== localTier) {
          config?.onMismatch?.(localTier, response.tier, remotePeerId);
          connection.close();
          return;
        }

        if (response.networkID !== localNetworkID) {
          config?.onMismatch?.(localTier, response.tier, remotePeerId);
          connection.close();
          return;
        }

        config?.onMatch?.(response.tier, response.networkID, remotePeerId);
      }
    } catch (err) {
      console.error('[TierNegotiation] Handler error:', err);
    }
  });

  node.addEventListener('peer:connect', async (event) => {
    const remotePeer = event.detail as any;
    const remotePeerId = remotePeer.toString();
    try {
      const stream = await node.dialProtocol(remotePeer, [PROTOCOL_TIER]);
      const localTier = getSecurityTier();
      const localNetworkID = getNetworkID();

      const push: TierIdentifyPush = {
        v: 2,
        tier: localTier as 0 | 1 | 2,
        peerID: node.peerId.toString(),
        ts: Date.now(),
        type: 'tier_identify',
        networkID: localNetworkID,
      };

      const encoded = new TextEncoder().encode(JSON.stringify(push));
      await stream.sink([encoded]);

      const chunks: Uint8Array[] = [];
      for await (const chunk of stream.source) {
        chunks.push(Uint8Array.from(chunk instanceof Uint8Array ? chunk : chunk.subarray()));
      }

      if (chunks.length > 0) {
        const response = JSON.parse(new TextDecoder().decode(chunks[0])) as TierIdentifyPush;
        peerTiers.set(remotePeerId, {
          tier: response.tier,
          networkID: response.networkID,
          ts: Date.now(),
        });

        if (response.tier !== localTier) {
          config?.onMismatch?.(localTier, response.tier, remotePeerId);
          const conns = node.getConnections(remotePeer);
          if (conns[0]) conns[0].close();
          return;
        }

        if (response.networkID !== localNetworkID) {
          config?.onMismatch?.(localTier, response.tier, remotePeerId);
          const conns = node.getConnections(remotePeer);
          if (conns[0]) conns[0].close();
          return;
        }

        config?.onMatch?.(response.tier, response.networkID, remotePeerId);
      }
    } catch (err) {
      console.debug(`[TierNegotiation] Could not negotiate tier with ${remotePeerId}:`, err);
    }
  });
}
