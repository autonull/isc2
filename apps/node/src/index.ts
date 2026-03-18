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

export async function main(): Promise<void> {
  console.log('Starting ISC Node Relay Server...');

  const { createEd25519PeerId } = await import('@libp2p/peer-id-factory');
  const peerId = await createEd25519PeerId();

  const node = await createLibp2p({
    peerId,
    start: false,
    addresses: {
      listen: [
        '/ip4/127.0.0.1/tcp/9090/ws', // WebSockets for browser compatibility
        '/ip4/127.0.0.1/udp/9091/quic-v1/webtransport' // WebTransport fallback
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
      // Enable circuit relay v2 to let browsers proxy connections through this node to establish WebRTC
      relay: circuitRelayServer({
          reservations: {
             maxReservations: Infinity,
             applyDefaultLimit: false,
          }
      }),
      dht: kadDHT({
        protocol: '/ipfs/kad/1.0.0', // Ensure protocol matches browser's default kadDHT
        clientMode: false // Act as a DHT server/router
      }),
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true })
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
}

// Support executing directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to start node:', err);
    process.exit(1);
  });
}
