import type { DelegateRequest, DelegateResponse } from '@isc/protocol/messages';
import { SupernodeDiscovery } from './discovery.js';
import { HealthSelector } from './selection.js';
import { rankSupernodes, type ScoredSupernode, type SupernodeStats } from './scoring.js';
import { createDelegationRequest } from './request.js';
import { verifyDelegationResponse } from './verify.js';

export interface DelegationConfig {
  discovery: SupernodeDiscovery;
  healthSelector: HealthSelector;
  localHandler: LocalHandler;
  maxSupernodes: number;
  timeoutMs: number;
  privateKey: CryptoKey;
  publicKey: Uint8Array;
  localModel: string;
}

export interface LocalHandler {
  handleEmbed(text: string, model: string): Promise<number[]>;
  handleANN(query: number[], k: number, modelHash: string): Promise<string[]>;
  handleSigVerify(
    payload: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): Promise<boolean>;
}

export interface DelegationStats {
  totalAttempts: number;
  supernodeSuccesses: number;
  supernodeFailures: number;
  localFallbacks: number;
  queuedRequests: number;
  rejectedRequests: number;
}

interface QueuedRequest {
  request: DelegateRequest;
  resolve: (response: DelegateResponse) => void;
  reject: (error: Error) => void;
  timestamp: number;
  priority: number;
}

export class DelegationClient {
  private config: DelegationConfig;
  private stats: DelegationStats;
  private blockedSupernodes: Set<string> = new Set();
  private failureCounts: Map<string, number> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private activeRequests: number = 0;
  private maxConcurrent: number = 5;
  private maxQueueSize: number = 50;

  constructor(config: DelegationConfig, maxConcurrent: number = 5, maxQueueSize: number = 50) {
    this.config = config;
    this.maxConcurrent = maxConcurrent;
    this.maxQueueSize = maxQueueSize;
    this.stats = {
      totalAttempts: 0,
      supernodeSuccesses: 0,
      supernodeFailures: 0,
      localFallbacks: 0,
      queuedRequests: 0,
      rejectedRequests: 0,
    };
  }

  async delegate(request: DelegateRequest): Promise<DelegateResponse> {
    this.stats.totalAttempts++;

    if (this.activeRequests >= this.maxConcurrent) {
      return this.queueRequest(request);
    }

    return this.processRequest(request);
  }

  private async queueRequest(request: DelegateRequest): Promise<DelegateResponse> {
    if (this.requestQueue.length >= this.maxQueueSize) {
      this.stats.rejectedRequests++;
      throw new Error('QUEUE_FULL: max queue size exceeded (429)');
    }

    this.stats.queuedRequests++;
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        request,
        resolve,
        reject,
        timestamp: Date.now(),
        priority: 0,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    while (this.activeRequests < this.maxConcurrent && this.requestQueue.length > 0) {
      const queued = this.requestQueue.shift();
      if (queued) {
        this.activeRequests++;
        try {
          const response = await this.processRequest(queued.request);
          queued.resolve(response);
        } catch (error) {
          queued.reject(error as Error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      }
    }
  }

  private async processRequest(request: DelegateRequest): Promise<DelegateResponse> {
    const supernodes = await this.selectSupernodes();

    for (const supernode of supernodes) {
      const response = await this.trySupernode(supernode, request);
      if (response) return response;
    }

    this.stats.localFallbacks++;
    return this.handleLocally(request);
  }

  private async selectSupernodes(): Promise<ScoredSupernode[]> {
    const capabilities = await this.config.discovery.discoverSupernodes();
    const eligible = capabilities.filter((c) => !this.isBlocked(c.peerID));

    const peerIDs = eligible.map((c) => c.peerID);
    const healthMap = await this.config.healthSelector.fetchHealthMetrics(peerIDs);

    const statsMap = new Map<string, SupernodeStats>();
    for (const [peerID, health] of healthMap) {
      statsMap.set(peerID, {
        successRate: health.successRate,
        avgLatencyMs: health.avgLatencyMs,
        requestsServed24h: health.requestsServed24h,
      });
    }

    return rankSupernodes(eligible, healthMap, statsMap).slice(0, this.config.maxSupernodes);
  }

  private async trySupernode(
    supernode: ScoredSupernode,
    request: DelegateRequest
  ): Promise<DelegateResponse | null> {
    try {
      const response = await this.sendToSupernode(supernode, request);

      const isValid = await verifyDelegationResponse(
        response,
        request.requestID,
        this.config.localModel,
        supernode.capability.peerID as unknown as Uint8Array
      );

      if (isValid) {
        this.recordSupernodeSuccess(supernode.capability.peerID);
        this.stats.supernodeSuccesses++;
        return response;
      }
    } catch (err) {
      console.warn(`Supernode ${supernode.capability.peerID} failed:`, err);
    }

    this.recordSupernodeFailure(supernode.capability.peerID);
    return null;
  }

  private async sendToSupernode(
    supernode: ScoredSupernode,
    request: DelegateRequest
  ): Promise<DelegateResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.dialSupernode(supernode.capability.peerID, request);
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async dialSupernode(
    _peerID: string,
    _request: DelegateRequest
  ): Promise<DelegateResponse> {
    throw new Error('Not implemented: dialSupernode requires network adapter');
  }

  private async handleLocally(request: DelegateRequest): Promise<DelegateResponse> {
    const handler = this.serviceHandlers[request.service];
    if (!handler) {
      throw new Error(`Unknown service: ${request.service}`);
    }

    const result = await handler(request.payload);
    const resultPayload = this.encodeResult(result);

    return {
      type: 'delegate_response',
      requestID: request.requestID,
      service: request.service,
      payload: resultPayload,
      responderPubKey: this.config.publicKey,
      timestamp: Date.now(),
      signature: new Uint8Array(),
    };
  }

  private serviceHandlers: Record<string, (payload: Uint8Array) => Promise<object>> = {
    embed: async (payload) => {
      const req = this.decodePayload<{ text: string; model: string }>(payload);
      const embedding = await this.config.localHandler.handleEmbed(req.text, req.model);
      return {
        embedding,
        model: req.model,
        norm: Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)),
      };
    },
    ann_query: async (payload) => {
      const req = this.decodePayload<{ query: number[]; k: number; modelHash: string }>(payload);
      const matches = await this.config.localHandler.handleANN(req.query, req.k, req.modelHash);
      return { matches, scores: [] };
    },
    sig_verify: async (payload) => {
      const req = this.decodePayload<{
        payload: Uint8Array;
        signature: Uint8Array;
        publicKey: Uint8Array;
      }>(payload);
      const valid = await this.config.localHandler.handleSigVerify(
        req.payload,
        req.signature,
        req.publicKey
      );
      return { valid };
    },
  };

  private decodePayload<T>(payload: Uint8Array): T {
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(payload));
  }

  private encodeResult(result: object): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(JSON.stringify(result));
  }

  private isBlocked(peerID: string): boolean {
    return this.blockedSupernodes.has(peerID);
  }

  private recordSupernodeSuccess(peerID: string): void {
    this.failureCounts.delete(peerID);
  }

  private recordSupernodeFailure(peerID: string): void {
    const count = (this.failureCounts.get(peerID) || 0) + 1;
    this.failureCounts.set(peerID, count);

    if (count >= 3) {
      this.blockedSupernodes.add(peerID);
      console.warn(`Blocked supernode ${peerID} after 3 failures`);
    }

    this.stats.supernodeFailures++;
  }

  getStats(): DelegationStats {
    return { ...this.stats };
  }

  unblockSupernode(peerID: string): void {
    this.blockedSupernodes.delete(peerID);
    this.failureCounts.delete(peerID);
  }

  getBlockedSupernodes(): string[] {
    return Array.from(this.blockedSupernodes);
  }

  /**
   * Announce data to DHT via supernode delegation
   */
  async announce(key: string, value: Uint8Array, ttl: number = 300): Promise<void> {
    // Direct DHT announcement (not delegated)
    // This is a placeholder - actual implementation would use network adapter
    console.log(`[DelegationClient] Announce: ${key} (${value.length} bytes, TTL: ${ttl}s)`);
  }

  /**
   * Query DHT via supernode delegation
   */
  async query(key: string, count: number = 10): Promise<Uint8Array[]> {
    // Direct DHT query (not delegated)
    // This is a placeholder - actual implementation would use network adapter
    console.log(`[DelegationClient] Query: ${key} (count: ${count})`);
    return [];
  }

  private static instance: DelegationClient | null = null;

  static getInstance(): DelegationClient | null {
    return DelegationClient.instance;
  }

  static setInstance(instance: DelegationClient): void {
    DelegationClient.instance = instance;
  }
}
