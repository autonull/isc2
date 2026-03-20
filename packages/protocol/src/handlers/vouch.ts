/**
 * ISC Phase P2.3: Vouch Protocol /isc/vouch/1.0
 *
 * New peers (reputation = 0) trigger vouch flow on first connect.
 * High-rep peers (score > 50) auto-grant vouches for Tier 1.
 * Vouches are stored in IndexedDB and published to DHT.
 */

import type { Vouch, VouchRequest, VouchResponse } from '../messages.js';
import type { Libp2p } from 'libp2p';
import { getSecurityTier } from '@isc/core';
import { PROTOCOL_VOUCH } from '../constants.js';
import { getReputationWithDecay } from './score.js';

export interface VouchStore {
  save(vouch: Vouch): Promise<void>;
  get(peerId: string): Promise<Vouch[]>;
  hasVouch(peerId: string, voucherId: string): Promise<boolean>;
}

export interface VouchServiceConfig {
  getSigningKey: () => Promise<CryptoKeyPair>;
  getPublicKey: () => Promise<CryptoKey>;
  getPeerId: () => string;
  store: VouchStore;
  onVouchReceived?: (vouch: Vouch) => void;
}

const MIN_REP_TO_VOUCH = 50;
const VOUCH_GRANT_WINDOW_MS = 30_000;
const VOUCH_RATE_LIMIT = 5;

const vouchState = new Map<string, { count: number; resetAt: number }>();

let vouchConfig: VouchServiceConfig | null = null;

export function initializeVouchService(node: Libp2p, config: VouchServiceConfig): void {
  if (getSecurityTier() < 1) return;

  vouchConfig = config;

  node.handle([PROTOCOL_VOUCH], async ({ stream }) => {
    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream.source) {
        chunks.push(Uint8Array.from(chunk instanceof Uint8Array ? chunk : chunk.subarray()));
      }
      if (chunks.length === 0) return;

      const msg = JSON.parse(new TextDecoder().decode(chunks[0]));

      if (msg.type === 'vouch_request') {
        await handleVouchRequest(msg as VouchRequest, stream);
      } else if (msg.type === 'vouch_response') {
        await handleVouchResponse(msg as VouchResponse);
      }
    } catch (err) {
      console.debug('[Vouch] Handler error:', err);
    }
  });
}

async function handleVouchRequest(req: VouchRequest, stream: any): Promise<void> {
  if (!vouchConfig) return;

  const myRep = getReputationWithDecay(vouchConfig.getPeerId());
  const myId = vouchConfig.getPeerId();
  const reqId = req.requesterID;

  if (myRep < MIN_REP_TO_VOUCH) {
    const response: VouchResponse = {
      v: 2,
      tier: getSecurityTier() as 0 | 1 | 2,
      peerID: myId,
      ts: Date.now(),
      type: 'vouch_response',
      voucherID: myId,
      voucheeID: reqId,
      granted: false,
    };
    await stream.sink([new TextEncoder().encode(JSON.stringify(response))]);
    return;
  }

  if (!checkVouchRateLimit(myId)) {
    console.debug(`[Vouch] Rate limited: ${myId}`);
    return;
  }

  const vouch: Vouch = {
    voucherID: myId,
    voucheeID: reqId,
    granted: true,
    ts: Date.now(),
    sig: new Uint8Array(),
  };

  if (vouchConfig.getSigningKey) {
    try {
      const keypair = await vouchConfig.getSigningKey();
      const payload = new TextEncoder().encode(
        JSON.stringify({ voucherID: myId, voucheeID: reqId, ts: vouch.ts })
      );
      const sig = await globalThis.crypto.subtle.sign('Ed25519', keypair.privateKey, payload);
      vouch.sig = new Uint8Array(sig);
    } catch (err) {
      console.warn('[Vouch] Failed to sign vouch:', err);
    }
  }

  await vouchConfig.store.save(vouch);
  vouchConfig.onVouchReceived?.(vouch);

  const response: VouchResponse = {
    v: 2,
    tier: getSecurityTier() as 0 | 1 | 2,
    peerID: myId,
    ts: Date.now(),
    type: 'vouch_response',
    voucherID: myId,
    voucheeID: reqId,
    granted: true,
    voucherSig: vouch.sig,
  };

  await stream.sink([new TextEncoder().encode(JSON.stringify(response))]);
}

async function handleVouchResponse(resp: VouchResponse): Promise<void> {
  if (!vouchConfig) return;
  if (!resp.granted) return;

  const vouch: Vouch = {
    voucherID: resp.voucherID,
    voucheeID: resp.voucheeID,
    granted: true,
    ts: resp.ts,
    sig: resp.voucherSig || new Uint8Array(),
  };

  await vouchConfig.store.save(vouch);
  vouchConfig.onVouchReceived?.(vouch);
}

function checkVouchRateLimit(peerId: string): boolean {
  const now = Date.now();
  let state = vouchState.get(peerId);

  if (!state || now > state.resetAt) {
    state = { count: 0, resetAt: now + 3_600_000 };
    vouchState.set(peerId, state);
  }

  if (state.count >= VOUCH_RATE_LIMIT) return false;
  state.count++;
  return true;
}

export async function requestVouches(
  node: Libp2p,
  _peerId: string,
  vouchesNeeded = 2
): Promise<Vouch[]> {
  if (getSecurityTier() < 1) return [];
  if (!vouchConfig) return [];

  const myId = vouchConfig.getPeerId();
  const publicKey = await vouchConfig.getPublicKey();
  const publicKeyBytes = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', publicKey));

  const request: VouchRequest = {
    v: 2,
    tier: getSecurityTier() as 0 | 1 | 2,
    peerID: myId,
    ts: Date.now(),
    type: 'vouch_request',
    requesterID: myId,
    requesterPublicKey: publicKeyBytes,
  };

  const results: Vouch[] = [];
  const deadline = Date.now() + VOUCH_GRANT_WINDOW_MS;

  try {
    const stream = await node.dialProtocol(node.peerId, [PROTOCOL_VOUCH]);
    await stream.sink([new TextEncoder().encode(JSON.stringify(request))]);

    while (Date.now() < deadline && results.length < vouchesNeeded) {
      for await (const chunk of stream.source) {
        const data = Uint8Array.from(chunk instanceof Uint8Array ? chunk : chunk.subarray());
        const resp = JSON.parse(new TextDecoder().decode(data)) as VouchResponse;
        if (resp.granted) {
          results.push({
            voucherID: resp.voucherID,
            voucheeID: resp.voucheeID,
            granted: true,
            ts: resp.ts,
            sig: resp.voucherSig || new Uint8Array(),
          });
        }
        if (results.length >= vouchesNeeded) break;
      }
    }
  } catch (err) {
    console.debug('[Vouch] Vouch request failed:', err);
  }

  return results;
}

export function shutdownVouchService(): void {
  vouchConfig = null;
  vouchState.clear();
}
