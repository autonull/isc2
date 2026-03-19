/**
 * WebSocket Admin API for ISC Relay Node
 *
 * Provides real-time control and monitoring for relay operators.
 * Authentication required for write operations.
 *
 * Endpoints:
 * - status: Get node status and metrics
 * - config: Update node configuration
 * - simulator/*: Control simulator module
 * - peers: View connected peers
 * - logs: Stream node logs
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Libp2p } from 'libp2p';
import type { Simulator } from '../services/simulator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AdminConfig {
  port: number;
  authToken: string;
  allowedIPs: string[];
}

export interface AdminRequest {
  id: string;
  action: string;
  params?: Record<string, any>;
  authToken?: string;
}

export interface AdminResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

const DEFAULT_CONFIG: AdminConfig = {
  port: 9091,
  authToken: 'admin-token-change-me',
  allowedIPs: [],
};

export class AdminAPI {
  private config: AdminConfig;
  private relayNode: Libp2p | null = null;
  private simulator: Simulator | null = null;
  private server: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private logBuffer: string[] = [];
  private adminUiHtml: string | null = null;

  constructor(config: Partial<AdminConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize admin API with node services
   */
  initialize(relayNode: Libp2p, simulator?: Simulator): void {
    this.relayNode = relayNode;
    this.simulator = simulator || null;
  }

  /**
   * Start WebSocket admin server with HTTP for UI
   */
  async start(): Promise<void> {
    // Load admin UI HTML
    try {
      const uiPath = join(__dirname, '../admin-ui.html');
      this.adminUiHtml = await readFile(uiPath, 'utf-8');
      console.log('[AdminAPI] Admin UI loaded');
    } catch (err) {
      console.warn('[AdminAPI] Admin UI not found, WebSocket only');
    }

    // Create HTTP server
    this.server = createServer((req, res) => this.handleHttp(req, res));

    // Attach WebSocket server
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress || 'unknown';

      if (this.config.allowedIPs.length > 0 && !this.config.allowedIPs.includes(ip)) {
        ws.close(4003, 'IP not allowed');
        return;
      }

      this.handleConnection(ws, ip);
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(this.config.port, () => {
        console.log(`[AdminAPI] Server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Handle HTTP requests (serve admin UI)
   */
  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    if (req.url === '/' || req.url === '/admin') {
      if (this.adminUiHtml) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.adminUiHtml);
      } else {
        res.writeHead(404);
        res.end('Admin UI not available');
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  }

  /**
   * Stop admin server
   */
  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.clients.clear();
  }

  /**
   * Log a message (buffered for admin viewing)
   */
  log(message: string): void {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.logBuffer.push(entry);
    if (this.logBuffer.length > 1000) {
      this.logBuffer.shift();
    }
    this.broadcast({ type: 'log', message: entry });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, ip: string): void {
    console.log(`[AdminAPI] Client connected from ${ip}`);
    this.clients.add(ws);

    this.send(ws, { type: 'welcome', message: 'Connected to ISC Relay Admin API' });

    ws.on('message', (data) => {
      try {
        const request = JSON.parse(data.toString()) as AdminRequest;
        this.handleRequest(ws, request);
      } catch (err) {
        this.send(ws, { type: 'error', message: 'Invalid JSON' });
      }
    });

    ws.on('close', () => {
      console.log(`[AdminAPI] Client disconnected from ${ip}`);
      this.clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error(`[AdminAPI] Client error from ${ip}:`, err.message);
      this.clients.delete(ws);
    });
  }

  /**
   * Handle incoming request
   */
  private handleRequest(ws: WebSocket, request: AdminRequest): void {
    const { id, action, params, authToken } = request;

    const requiresAuth = ['config', 'simulator'].some(prefix => action.startsWith(prefix));
    if (requiresAuth && authToken !== this.config.authToken) {
      this.send(ws, { id, success: false, error: 'Authentication required' });
      return;
    }

    this.routeRequest(ws, id, action, params)
      .then(data => this.send(ws, { id, success: true, data }))
      .catch(err => this.send(ws, { id, success: false, error: err.message }));
  }

  /**
   * Route request to handler
   */
  private async routeRequest(
    ws: WebSocket,
    id: string,
    action: string,
    params?: Record<string, any>
  ): Promise<any> {
    switch (action) {
      case 'status':
        return this.getStatus();
      case 'config':
        return this.updateConfig(params);
      case 'simulator:start':
        return this.simulatorStart(params?.botCount);
      case 'simulator:stop':
        return this.simulatorStop();
      case 'simulator:status':
        return this.simulatorStatus();
      case 'simulator:config':
        return this.simulatorConfigure(params);
      case 'simulator:bots':
        return this.simulatorGetBots();
      case 'peers':
        return this.getPeers();
      case 'logs':
        return this.getLogs(params?.lines || 100);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Get node status
   */
  private async getStatus(): Promise<any> {
    if (!this.relayNode) {
      throw new Error('Relay node not initialized');
    }

    const peerId = this.relayNode.peerId.toString();
    const connections = this.relayNode.getConnections();
    const multiaddrs = this.relayNode.getMultiaddrs();

    return {
      peerId,
      status: this.relayNode.status,
      connections: connections.length,
      addresses: multiaddrs.map(a => a.toString()),
      protocols: Array.from(this.relayNode.getProtocols()),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  /**
   * Update node configuration
   */
  private async updateConfig(params?: Record<string, any>): Promise<any> {
    return { updated: true, config: params };
  }

  /**
   * Start simulator
   */
  private async simulatorStart(botCount?: number): Promise<any> {
    if (!this.simulator) {
      throw new Error('Simulator not available');
    }

    await this.simulator.start(botCount || 5);
    return { started: true, botCount: botCount || 5 };
  }

  /**
   * Stop simulator
   */
  private async simulatorStop(): Promise<any> {
    if (!this.simulator) {
      throw new Error('Simulator not available');
    }

    await this.simulator.stop();
    return { stopped: true };
  }

  /**
   * Get simulator status
   */
  private async simulatorStatus(): Promise<any> {
    if (!this.simulator) {
      return { available: false };
    }

    return { available: true, ...this.simulator.getMetrics() };
  }

  /**
   * Configure simulator
   */
  private async simulatorConfigure(params?: Record<string, any>): Promise<any> {
    if (!this.simulator) {
      throw new Error('Simulator not available');
    }

    this.simulator.configure(params || {});
    return { configured: true };
  }

  /**
   * Get bot list
   */
  private async simulatorGetBots(): Promise<any> {
    if (!this.simulator) {
      return { bots: [] };
    }

    return { bots: this.simulator.getBots() };
  }

  /**
   * Get connected peers
   */
  private async getPeers(): Promise<any> {
    if (!this.relayNode) {
      throw new Error('Relay node not initialized');
    }

    const connections = this.relayNode.getConnections();
    return {
      count: connections.length,
      peers: connections.map(conn => ({
        peerId: conn.remotePeer.toString(),
        protocols: Array.from(conn.streams.map(s => s.protocol).filter(Boolean)),
        status: conn.status,
      })),
    };
  }

  /**
   * Get log buffer
   */
  private async getLogs(lines: number): Promise<any> {
    const start = Math.max(0, this.logBuffer.length - lines);
    return { logs: this.logBuffer.slice(start) };
  }

  /**
   * Send message to specific client
   */
  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all clients
   */
  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}

/**
 * Create admin API instance
 */
export function createAdminAPI(config?: Partial<AdminConfig>): AdminAPI {
  return new AdminAPI(config);
}
