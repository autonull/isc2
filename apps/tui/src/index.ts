import blessed from 'blessed';
import { createLibp2p, Libp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT } from '@libp2p/kad-dht';
import { identify } from '@libp2p/identify';
import { createEd25519PeerId } from '@libp2p/peer-id-factory';
import { NodeModel } from '@isc/adapters/node';
import { cosineSimilarity } from '@isc/core';
import { multiaddr } from '@multiformats/multiaddr';
import { ping } from '@libp2p/ping';

export interface CitizenState {
  id: string;
  description: string;
  messages: string[];
}

export class TUI {
  private screen: blessed.Widgets.Screen;
  private messageBoxes: blessed.Widgets.Log[] = [];
  private inputBoxes: blessed.Widgets.TextboxElement[] = [];
  private nodes: Libp2p[] = [];
  private peers: { id: string, port: number }[] = [];
  private model = new NodeModel();
  private citizenDescriptions: string[] = [
    'AI ethics and machine learning autonomy',
    'Distributed systems consensus algorithms CAP theorem',
    'Climate technology carbon capture renewable energy',
    'Neuroscience brain computer interfaces neural plasticity',
    'Quantum computing error correction algorithms'
  ];
  private citizenVectors: number[][] = [];

  constructor(private numCitizens: number) {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'ISC Network Simulator'
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });

    this.setupLayout();
  }

  private setupLayout() {
    const width = Math.floor(100 / this.numCitizens);

    for (let i = 0; i < this.numCitizens; i++) {
      const left = `${i * width}%`;

      // Main container for this citizen
      const box = blessed.box({
        top: 0,
        left: left,
        width: `${width}%`,
        height: '100%',
        border: { type: 'line' },
        style: {
          border: { fg: 'blue' }
        },
        label: ` Citizen ${i + 1} `
      });

      // Output box for messages
      const messageBox = blessed.log({
        parent: box,
        top: 0,
        left: 0,
        width: '100%-2',
        height: '100%-5',
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: ' ',
          style: { bg: 'blue' }
        }
      });

      // Divider
      blessed.line({
        parent: box,
        top: '100%-5',
        left: 0,
        width: '100%-2',
        orientation: 'horizontal'
      });

      // Input box for typing
      const inputBox = blessed.textbox({
        parent: box,
        top: '100%-4',
        left: 0,
        width: '100%-2',
        height: 3,
        keys: true,
        mouse: true,
        inputOnFocus: true,
        style: {
          focus: { bg: 'blue', fg: 'white' }
        }
      });

      // Handle focus
      inputBox.key(['tab'], () => {
        const nextIndex = (i + 1) % this.numCitizens;
        this.inputBoxes[nextIndex].focus();
        this.screen.render();
      });

      this.messageBoxes.push(messageBox);
      this.inputBoxes.push(inputBox);
      this.screen.append(box);
    }

    // Focus first input
    if (this.inputBoxes.length > 0) {
      this.inputBoxes[0].focus();
    }
  }

  public async initNetwork() {
    this.logMessage(0, 'Initializing libp2p networks & model...');

    // Load local mock model
    await this.model.load('mock-model-path');

    // Create actual libp2p nodes and compute embeddings
    for (let i = 0; i < this.numCitizens; i++) {
      const desc = this.citizenDescriptions[i % this.citizenDescriptions.length];
      const vec = await this.model.embed(desc);
      this.citizenVectors.push(vec);

      const port = 40000 + i;
      const peerId = await createEd25519PeerId();

      const node = await createLibp2p({
        // @ts-ignore
        peerId: peerId,
        addresses: {
          listen: [`/ip4/127.0.0.1/tcp/${port}/ws`]
        },
        transports: [webSockets()],
        connectionEncryption: [noise()],
        streamMuxers: [yamux()],
        services: {
          identify: identify() as any,
          ping: ping() as any,
          dht: kadDHT({
            protocol: '/isc/kad/1.0.0',
            clientMode: false
          }) as any
        }
      });

      this.nodes.push(node);
      this.peers.push({ id: peerId.toString(), port });

      this.logMessage(i, `Node started. Peer ID: ${peerId.toString().slice(-6)}`);
      this.logMessage(i, `Interest: ${desc}`);

      // Handle pubsub or direct messages here (custom protocol)
      node.handle('/isc/chat/1.0.0', async ({ stream: reqStream }: any) => {
        const decoder = new TextDecoder();
        const chunks = [];
        for await (const chunk of reqStream.source) {
          chunks.push(chunk.subarray());
        }
        const msg = decoder.decode(Buffer.concat(chunks));
        this.logMessage(i, `[Received]: ${msg}`);
      });
    }

    // Dial peers in a ring
    for (let i = 0; i < this.numCitizens; i++) {
      const node = this.nodes[i];
      const nextIndex = (i + 1) % this.numCitizens;
      const nextPort = this.peers[nextIndex].port;

      try {
        await node.dial(multiaddr(`/ip4/127.0.0.1/tcp/${nextPort}/ws`));
        this.logMessage(i, `Connected to Citizen ${nextIndex + 1}`);
      } catch (err) {
        this.logMessage(i, `Failed to connect: ${err}`);
      }
    }
  }

  public async broadcast(fromIndex: number, message: string) {
    const node = this.nodes[fromIndex];
    const encoder = new TextEncoder();
    const vecA = this.citizenVectors[fromIndex];

    // Semantic broadcast to peers
    for (let i = 0; i < this.numCitizens; i++) {
      if (i === fromIndex) continue;

      const vecB = this.citizenVectors[i];
      const sim = cosineSimilarity(vecA, vecB);

      // Only send if semantic similarity > 0.5
      if (sim > 0.5) {
        const peerIdStr = this.peers[i].id;
        try {
          // Attempt to connect and send
          for (const peer of node.getPeers()) {
            if (peer.toString() === peerIdStr) {
               const dialStream: any = await node.dialProtocol(peer, '/isc/chat/1.0.0');
               await dialStream.sink([encoder.encode(`[sim: ${sim.toFixed(2)}] ${message}`)]);
            }
          }
        } catch (err) {
          this.logMessage(fromIndex, `Failed to send to ${peerIdStr.slice(-6)}`);
        }
      }
    }
  }

  public logMessage(citizenIndex: number, message: string) {
    if (citizenIndex >= 0 && citizenIndex < this.numCitizens) {
      this.messageBoxes[citizenIndex].log(message);
      this.screen.render();
    }
  }

  public onInput(citizenIndex: number, callback: (text: string) => void) {
    if (citizenIndex >= 0 && citizenIndex < this.numCitizens) {
      this.inputBoxes[citizenIndex].on('submit', async (text: string) => {
        if (text && text.trim().length > 0) {
          callback(text);
          await this.broadcast(citizenIndex, text);
          this.inputBoxes[citizenIndex].clearValue();
          this.inputBoxes[citizenIndex].focus();
          this.screen.render();
        }
      });
    }
  }

  public render() {
    this.screen.render();
  }
}
