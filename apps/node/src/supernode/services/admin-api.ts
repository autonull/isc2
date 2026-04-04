/* eslint-disable */
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Libp2p } from 'libp2p';
import type { Simulator } from './simulator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AdminConfig {
  port: number;
  authToken: string;
  allowedIPs: string[];
}

export interface AdminRequest {
  id: string;
  action: string;
  params?: Record<string, unknown>;
  authToken?: string;
}

export interface AdminResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface HealthStatus {
  status: string;
  peers: number;
  uptime: number;
  version: string;
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
  private startTime = Date.now();
  private relayRequestsTotal = 0;

  constructor(config: Partial<AdminConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  initialize(relayNode: Libp2p, simulator?: Simulator): void {
    this.relayNode = relayNode;
    this.simulator = simulator ?? null;

    relayNode.addEventListener?.('peer:connect', () => {
      this.dhtOperationsTotal++;
    });
  }

  private dhtOperationsTotal = 0;

  async start(): Promise<void> {
    this.startTime = Date.now();

    try {
      this.adminUiHtml = await readFile(join(__dirname, '../admin-ui.html'), 'utf-8');
      console.log('[AdminAPI] Admin UI loaded');
    } catch {
      console.warn('[AdminAPI] Admin UI not found, WebSocket only');
    }

    this.server = createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress ?? 'unknown';
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

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    this.relayRequestsTotal++;
    const path = req.url ?? '';

    if (path === '/health') {
      const health = this.getHealthStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }

    if (path === '/metrics') {
      const metrics = this.getPrometheusMetrics();
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(metrics);
      return;
    }

    if (path === '/' || path === '/admin') {
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

  private getHealthStatus(): HealthStatus {
    const peers = this.relayNode?.getConnections().length ?? 0;
    return {
      status: 'ok',
      peers,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: '0.1.0',
    };
  }

  private getPrometheusMetrics(): string {
    const lines: string[] = [];
    const peers = this.relayNode?.getConnections().length ?? 0;
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    lines.push('# HELP isc_connected_peers Number of active peer connections');
    lines.push('# TYPE isc_connected_peers gauge');
    lines.push(`isc_connected_peers ${peers}`);

    lines.push('# HELP isc_uptime_seconds Node uptime in seconds');
    lines.push('# TYPE isc_uptime_seconds counter');
    lines.push(`isc_uptime_seconds ${uptime}`);

    lines.push('# HELP isc_relay_requests_total Total relay requests handled');
    lines.push('# TYPE isc_relay_requests_total counter');
    lines.push(`isc_relay_requests_total ${this.relayRequestsTotal}`);

    lines.push('# HELP isc_dht_operations_total Total DHT operations performed');
    lines.push('# TYPE isc_dht_operations_total counter');
    lines.push(`isc_dht_operations_total ${this.dhtOperationsTotal}`);

    if (this.simulator) {
      const simMetrics = this.simulator.getMetrics?.() ?? {};
      lines.push('# HELP isc_simulator_bots Number of active simulator bots');
      lines.push('# TYPE isc_simulator_bots gauge');
      lines.push(`isc_simulator_bots ${simMetrics.activeBots ?? 0}`);
    }

    return lines.join('\n') + '\n';
  }

  stop(): void {
    this.wss?.close();
    this.wss = null;
    this.server?.close();
    this.server = null;
    this.clients.clear();
  }

  log(message: string): void {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.logBuffer.push(entry);
    if (this.logBuffer.length > 1000) this.logBuffer.shift();
    this.broadcast({ type: 'log', message: entry });
  }

  private handleConnection(ws: WebSocket, ip: string): void {
    console.log(`[AdminAPI] Client connected from ${ip}`);
    this.clients.add(ws);

    this.send(ws, { type: 'welcome', message: 'Connected to ISC Relay Admin API' });

    ws.on('message', (data) => {
      try {
        const request = JSON.parse(data.toString()) as AdminRequest;
        this.handleRequest(ws, request);
      } catch {
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

  private handleRequest(ws: WebSocket, request: AdminRequest): void {
    const { id, action, params, authToken } = request;
    const requiresAuth = action.startsWith('config') || action.startsWith('simulator');

    if (requiresAuth && authToken !== this.config.authToken) {
      this.send(ws, { id, success: false, error: 'Authentication required' });
      return;
    }

    this.routeRequest(ws, id, action, params)
      .then((data) => this.send(ws, { id, success: true, data }))
      .catch((err) => this.send(ws, { id, success: false, error: err.message }));
  }

  private async routeRequest(
    _ws: WebSocket,
    _id: string,
    action: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    switch (action) {
      case 'status':
        return this.getStatus();
      case 'config':
        return this.updateConfig(params);
      case 'simulator:start':
        return this.simulatorStart(params?.botCount as number | undefined);
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
        return this.getLogs((params?.lines as number) ?? 100);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private getStatus(): {
    peerId: string;
    status: string;
    connections: number;
    addresses: string[];
    protocols: string[];
    uptime: number;
    memory: ReturnType<typeof process.memoryUsage>;
  } {
    if (!this.relayNode) throw new Error('Relay node not initialized');

    const peerId = this.relayNode.peerId.toString();
    const connections = this.relayNode.getConnections();
    const multiaddrs = this.relayNode.getMultiaddrs();

    return {
      peerId,
      status: this.relayNode.status,
      connections: connections.length,
      addresses: multiaddrs.map((a) => a.toString()),
      protocols: Array.from(this.relayNode.getProtocols()),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  private updateConfig(params?: Record<string, unknown>): { updated: boolean; config: unknown } {
    return { updated: true, config: params };
  }

  private async simulatorStart(botCount?: number): Promise<{ started: boolean; botCount: number }> {
    if (!this.simulator) throw new Error('Simulator not available');
    const count = botCount ?? 5;
    await this.simulator.start(count);
    return { started: true, botCount: count };
  }

  private async simulatorStop(): Promise<{ stopped: boolean }> {
    if (!this.simulator) throw new Error('Simulator not available');
    await this.simulator.stop();
    return { stopped: true };
  }

  private simulatorStatus():
    | { available: boolean }
    | ({ available: true } & ReturnType<Simulator['getMetrics']>) {
    if (!this.simulator) return { available: false };
    return { available: true, ...this.simulator.getMetrics() };
  }

  private simulatorConfigure(params?: Record<string, unknown>): { configured: boolean } {
    if (!this.simulator) throw new Error('Simulator not available');
    this.simulator.configure(params ?? {});
    return { configured: true };
  }

  private simulatorGetBots(): { bots: ReturnType<Simulator['getBots']> } {
    if (!this.simulator) return { bots: [] };
    return { bots: this.simulator.getBots() };
  }

  private getPeers(): {
    count: number;
    peers: Array<{ peerId: string; protocols: string[]; status: string }>;
  } {
    if (!this.relayNode) throw new Error('Relay node not initialized');
    const connections = this.relayNode.getConnections();
    return {
      count: connections.length,
      peers: connections.map((conn) => ({
        peerId: conn.remotePeer.toString(),
        protocols: Array.from(conn.streams.map((s) => s.protocol).filter(Boolean) as string[]),
        status: String(conn.status),
      })),
    };
  }

  private getLogs(lines: number): { logs: string[] } {
    const start = Math.max(0, this.logBuffer.length - lines);
    return { logs: this.logBuffer.slice(start) };
  }

  private send(ws: WebSocket, message: unknown): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  private broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }
}

export function createAdminAPI(config?: Partial<AdminConfig>): AdminAPI {
  return new AdminAPI(config);
}
