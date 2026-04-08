/* eslint-disable */
import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { webTransport } from '@libp2p/webtransport';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT } from '@libp2p/kad-dht';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { ping } from '@libp2p/ping';
import { createSimulator } from './supernode/services/simulator.js';
import { createAdminAPI } from './supernode/services/admin-api.js';
import { createEmbeddingService, registerTierNegotiation } from '@isc/network';
import { setSecurityTier, getTierName, DEFAULT_GENESIS_HASH, TIER_PROTOCOL } from '@isc/core';
import type { Libp2p } from 'libp2p';
import type { Simulator } from './supernode/services/simulator.js';
import type { AdminAPI } from './supernode/services/admin-api.js';

const ENABLE_SIMULATOR = process.env.ISC_SIMULATOR === 'true';
const SIMULATOR_BOT_COUNT = parseInt(process.env.ISC_BOT_COUNT || '5');
const ADMIN_TOKEN = process.env.ISC_ADMIN_TOKEN || 'admin-token-change-me';
const ADMIN_PORT = parseInt(process.env.ISC_ADMIN_PORT || '9091');
const SECURITY_TIER = parseInt(process.env.ISC_TIER || '2') as 0 | 1 | 2;
const NETWORK_ID = process.env.ISC_NETWORK_ID || DEFAULT_GENESIS_HASH;

let node: Libp2p | null = null;
let simulator: Simulator | null = null;
let adminAPI: AdminAPI | null = null;

export async function main(): Promise<void> {
  console.log('Starting ISC Node Relay Server...');
  console.log(`Simulator: ${ENABLE_SIMULATOR ? 'Enabled' : 'Disabled'}`);

  setSecurityTier(SECURITY_TIER, NETWORK_ID);
  console.log(`Security tier: ${getTierName(SECURITY_TIER)} (${SECURITY_TIER})`);
  console.log(`Network ID: ${NETWORK_ID}`);

  const { createEd25519PeerId } = await import('@libp2p/peer-id-factory');
  const peerId = await createEd25519PeerId();
  // Ensure we have a private key for gossipsub signing.
  if (peerId.privateKey == null) {
      throw new Error("PeerId does not have a private key.");
  }

  const transports = [webSockets(), webTransport()];
  const streamMuxers = [yamux()];

  const connectionEncryption = SECURITY_TIER === 0 ? [] : [noise()];

  const dhtProtocol = SECURITY_TIER === 0 ? '/isc/kad/0.1.0' : '/ipfs/kad/1.0.0';

  node = await createLibp2p({
    peerId,
    start: false,
    addresses: {
      listen: ['/ip4/127.0.0.1/tcp/9090/ws', '/ip4/127.0.0.1/udp/9091/quic-v1/webtransport'],
    },
    transports,
    connectionEncryption,
    streamMuxers,
    services: {
      ping: ping(),
      identify: identify({
        protocolPrefix: 'ipfs',
        agentVersion: `isc-relay/0.1.0 tier=${SECURITY_TIER}`,
      }),
      relay: circuitRelayServer({
        reservations: { maxReservations: Infinity, applyDefaultLimit: false },
      }),
      dht: kadDHT({ protocol: dhtProtocol, clientMode: false }),
      pubsub: gossipsub({ allowPublishToZeroPeers: true }),
    },
  } as any);

  registerTierNegotiation(
    node,
    () => SECURITY_TIER,
    () => NETWORK_ID,
    {
      onMismatch: (local, remote, peerId) => {
        console.warn(`[Tier] Rejected ${peerId}: tier mismatch (local=${local}, remote=${remote})`);
      },
      onMatch: (tier, networkID, peerId) => {
        console.log(`[Tier] Accepted ${peerId}: tier=${tier}, network=${networkID}`);
      },
    }
  );

  await node.start();

  console.log('Relay server listening on:');
  node.getMultiaddrs().forEach((addr) => console.log(addr.toString()));

  const wsAddr = node.getMultiaddrs().find((a) => a.toString().includes('/ws'));
  if (wsAddr) console.log(`\n\nBOOTSTRAP_NODE=${wsAddr.toString()}\n\n`);

  if (ENABLE_SIMULATOR) {
    try {
      const embeddingService = createEmbeddingService();
      await embeddingService.load();

      simulator = createSimulator();
      await simulator.initialize(node, embeddingService);
      await simulator.start(SIMULATOR_BOT_COUNT);

      console.log(`[Simulator] Started with ${SIMULATOR_BOT_COUNT} bots`);
    } catch (err) {
      console.error('[Simulator] Failed to start:', err);
    }
  }

  adminAPI = createAdminAPI({ port: ADMIN_PORT, authToken: ADMIN_TOKEN });
  adminAPI.initialize(node, simulator ?? undefined);
  adminAPI.start();

  console.log(`[AdminAPI] Available at http://localhost:${ADMIN_PORT}`);
  console.log(`[AdminAPI] Token: ${ADMIN_TOKEN}`);
  console.log('\n=== ISC Relay Node Ready ===\n');
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Shutdown] Received ${signal}, starting graceful shutdown...`);

  if (simulator) {
    console.log('[Shutdown] Stopping simulator...');
    try {
      await simulator.stop();
    } catch (err) {
      console.error('[Shutdown] Error stopping simulator:', err);
    }
  }

  if (adminAPI) {
    console.log('[Shutdown] Stopping admin API...');
    try {
      adminAPI.stop();
    } catch (err) {
      console.error('[Shutdown] Error stopping admin API:', err);
    }
  }

  if (node) {
    console.log('[Shutdown] Stopping libp2p node...');
    try {
      await node.stop();
      console.log('[Shutdown] libp2p node stopped');
    } catch (err) {
      console.error('[Shutdown] Error stopping libp2p:', err);
    }
  }

  console.log('[Shutdown] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => {
  console.log('\n[Shutdown] SIGINT received');
  shutdown('SIGINT').catch((err) => {
    console.error('[Shutdown] Fatal error:', err);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Shutdown] SIGTERM received');
  shutdown('SIGTERM').catch((err) => {
    console.error('[Shutdown] Fatal error:', err);
    process.exit(1);
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to start node:', err);
    process.exit(1);
  });
}
