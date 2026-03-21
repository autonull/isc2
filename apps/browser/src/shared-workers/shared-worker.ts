/**
 * ISC SharedWorker - Persistent Network Connection
 *
 * Keeps libp2p node running when browser tabs are backgrounded/closed.
 * Enables DHT presence and message delivery across tabs.
 */

import type { BrowserNetworkAdapter } from '@isc/adapters';

interface SharedWorkerMessage {
  type: 'INITIALIZE' | 'DISCOVER' | 'ANNOUNCE' | 'SEND_MESSAGE' | 'GET_STATE' | 'SUBSCRIBE';
  payload?: any;
  tabId?: string;
}

interface SharedWorkerResponse {
  type: 'READY' | 'STATE' | 'MESSAGE_RECEIVED' | 'PEER_DISCOVERED' | 'ERROR';
  payload?: any;
  tabId?: string;
}

// Shared state across all tabs
let networkAdapter: BrowserNetworkAdapter | null = null;
let initialized = false;
let messageQueue: Map<string, any[]> = new Map(); // tabId -> queued messages
let connectedTabs: Set<string> = new Set();

// Message port for broadcasting to all tabs
let ports: MessagePort[] = [];

function broadcastToTabs(response: SharedWorkerResponse) {
  const data = JSON.stringify(response);
  ports.forEach(port => {
    try {
      port.postMessage(JSON.parse(data));
    } catch (err) {
      console.warn('[SharedWorker] Failed to post to port:', err);
    }
  });
}

function sendToTab(port: MessagePort, response: SharedWorkerResponse) {
  try {
    port.postMessage(response);
  } catch (err) {
    console.warn('[SharedWorker] Failed to send to tab:', err);
  }
}

async function initializeNetwork() {
  if (initialized && networkAdapter) return;

  try {
    console.log('[SharedWorker] Initializing network...');

    // Dynamic import to avoid bundling issues
    const { BrowserNetworkAdapter } = await import('@isc/adapters/browser');
    networkAdapter = new BrowserNetworkAdapter();

    await networkAdapter.start();
    initialized = true;

    console.log('[SharedWorker] Network initialized, peerId:', networkAdapter.getPeerId());

    // Subscribe to global topics
    networkAdapter.subscribe('isc:posts:global', (data: Uint8Array) => {
      const message = new TextDecoder().decode(data);
      console.log('[SharedWorker] Received message:', message);

      // Broadcast to all tabs
      broadcastToTabs({
        type: 'MESSAGE_RECEIVED',
        payload: {
          topic: 'isc:posts:global',
          data: message,
          timestamp: Date.now(),
        },
      });
    });

    broadcastToTabs({ type: 'READY', payload: { peerId: networkAdapter.getPeerId() } });
  } catch (err) {
    console.warn('[SharedWorker] Initialization failed (using direct network):', (err as Error).message);
    broadcastToTabs({
      type: 'ERROR',
      payload: { message: err instanceof Error ? err.message : String(err) },
    });
  }
}

async function handleMessage(port: MessagePort, message: SharedWorkerMessage) {
  const { type, payload, tabId } = message;

  console.log('[SharedWorker] Received message:', type, payload);

  switch (type) {
    case 'INITIALIZE':
      await initializeNetwork();
      break;

    case 'GET_STATE':
      sendToTab(port, {
        type: 'STATE',
        payload: {
          initialized,
          peerId: networkAdapter?.getPeerId() || null,
          connected: networkAdapter?.isRunning() || false,
          connectionCount: networkAdapter?.getConnectionCount() || 0,
        },
      });
      break;

    case 'DISCOVER':
      if (!networkAdapter) {
        sendToTab(port, { type: 'ERROR', payload: { message: 'Network not initialized' } });
        return;
      }
      // Trigger DHT discovery - results will be broadcast via MESSAGE_RECEIVED
      try {
        const peers = await networkAdapter.getConnectedPeers();
        sendToTab(port, {
          type: 'PEER_DISCOVERED',
          payload: { peers },
        });
      } catch (err) {
        sendToTab(port, {
          type: 'ERROR',
          payload: { message: err instanceof Error ? err.message : String(err) },
        });
      }
      break;

    case 'ANNOUNCE':
      if (!networkAdapter) {
        sendToTab(port, { type: 'ERROR', payload: { message: 'Network not initialized' } });
        return;
      }
      try {
        const { key, value, ttl } = payload;
        const keyBytes = new TextEncoder().encode(key);
        const valueBytes = new TextEncoder().encode(JSON.stringify(value));
        await networkAdapter.announce(keyBytes, valueBytes, ttl);
        sendToTab(port, { type: 'READY', payload: { success: true } });
      } catch (err) {
        sendToTab(port, {
          type: 'ERROR',
          payload: { message: err instanceof Error ? err.message : String(err) },
        });
      }
      break;

    case 'SEND_MESSAGE':
      if (!networkAdapter) {
        sendToTab(port, { type: 'ERROR', payload: { message: 'Network not initialized' } });
        return;
      }
      try {
        const { topic, data } = payload;
        const dataBytes = new TextEncoder().encode(JSON.stringify(data));
        await networkAdapter.publish(topic, dataBytes);
        sendToTab(port, { type: 'READY', payload: { success: true } });
      } catch (err) {
        sendToTab(port, {
          type: 'ERROR',
          payload: { message: err instanceof Error ? err.message : String(err) },
        });
      }
      break;

    case 'SUBSCRIBE':
      if (!networkAdapter) {
        sendToTab(port, { type: 'ERROR', payload: { message: 'Network not initialized' } });
        return;
      }
      try {
        const { topic } = payload;
        networkAdapter.subscribe(topic, (data: Uint8Array) => {
          sendToTab(port, {
            type: 'MESSAGE_RECEIVED',
            payload: {
              topic,
              data: new TextDecoder().decode(data),
              timestamp: Date.now(),
            },
          });
        });
        sendToTab(port, { type: 'READY', payload: { success: true } });
      } catch (err) {
        sendToTab(port, {
          type: 'ERROR',
          payload: { message: err instanceof Error ? err.message : String(err) },
        });
      }
      break;

    default:
      sendToTab(port, {
        type: 'ERROR',
        payload: { message: `Unknown message type: ${type}` },
      });
  }
}

// Handle connections from tabs
self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  ports.push(port);

  console.log('[SharedWorker] New tab connected, total ports:', ports.length);

  port.onmessage = async (e: MessageEvent<SharedWorkerMessage>) => {
    await handleMessage(port, e.data);
  };

  port.onmessageerror = (err) => {
    console.error('[SharedWorker] Message error:', err);
  };

  port.start();

  // Send current state to new tab
  if (initialized && networkAdapter) {
    sendToTab(port, {
      type: 'READY',
      payload: {
        peerId: networkAdapter.getPeerId(),
        initialized: true,
      },
    });
  }

  // Cleanup on tab close
  port.addEventListener('close', () => {
    ports = ports.filter(p => p !== port);
    console.log('[SharedWorker] Tab disconnected, remaining ports:', ports.length);
  });
};

console.log('[SharedWorker] Worker script loaded');
