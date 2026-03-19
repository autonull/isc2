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
import { generateKeyPair } from '@libp2p/crypto/keys';
import { createSimulator } from './supernode/services/simulator.js';
import { createAdminAPI } from './supernode/services/admin-api.js';
import { createEmbeddingService } from '@isc/network';

// Configuration from environment
const ENABLE_SIMULATOR = process.env.ISC_SIMULATOR === 'true';
const SIMULATOR_BOT_COUNT = parseInt(process.env.ISC_BOT_COUNT || '5');
const ADMIN_TOKEN = process.env.ISC_ADMIN_TOKEN || 'admin-token-change-me';
const ADMIN_PORT = parseInt(process.env.ISC_ADMIN_PORT || '9091');

export async function main(): Promise<void> {
  console.log('Starting ISC Node Relay Server...');
  console.log(`Simulator: ${ENABLE_SIMULATOR ? 'Enabled' : 'Disabled'}`);

  const { createEd25519PeerId } = await import('@libp2p/peer-id-factory');
  const peerId = await createEd25519PeerId();

  const node = await createLibp2p({
    peerId: peerId as any,
    start: false,
    addresses: {
      listen: [
        '/ip4/127.0.0.1/tcp/9090/ws',
        '/ip4/127.0.0.1/udp/9091/quic-v1/webtransport'
      ]
    },
    transports: [
      webSockets(),
      webTransport()
    ],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify({
        protocolPrefix: 'ipfs',
        agentVersion: 'isc-relay/0.1.0'
      }),
      ping: ping(),
      relay: circuitRelayServer({
        reservations: {
          maxReservations: Infinity,
          applyDefaultLimit: false,
        }
      }),
      dht: kadDHT({
        protocol: '/ipfs/kad/1.0.0',
        clientMode: false
      }),
      pubsub: gossipsub({ allowPublishToZeroPeers: true } as any) as any
    }
  });

  await node.start();

  console.log('Relay server listening on:');
  node.getMultiaddrs().forEach((addr) => {
    console.log(addr.toString());
  });

  const wsAddr = node.getMultiaddrs().find(a => a.toString().includes('/ws'));
  if (wsAddr) {
    console.log(`\n\nBOOTSTRAP_NODE=${wsAddr.toString()}\n\n`);
  }

  // Initialize Simulator if enabled
  let simulator = null;
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

  // Initialize Admin API
  const adminAPI = createAdminAPI({
    port: ADMIN_PORT,
    authToken: ADMIN_TOKEN,
  });
  adminAPI.initialize(node, simulator || undefined);
  adminAPI.start();

  console.log(`[AdminAPI] Available at http://localhost:${ADMIN_PORT}`);
  console.log(`[AdminAPI] Token: ${ADMIN_TOKEN}`);
  console.log('\n=== ISC Relay Node Ready ===\n');
}

// Support executing directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to start node:', err);
    process.exit(1);
  });
}
