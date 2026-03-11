import type {
  DelegateRequest,
  DelegateResponse,
  DelegateCapability,
  DelegationHealth,
} from '@isc/protocol/messages';
import { SupernodeDiscovery } from './discovery.js';
import { HealthSelector } from './selection.js';
import { rankSupernodes, type ScoredSupernode, type SupernodeStats } from './scoring.js';
import { createDelegationRequest, decryptResponsePayload } from './request.js';
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
    const supernodes = await this.getEligibleSupernodes();

    for (const supernode of supernodes) {
      if (this.isBlocked(supernode.capability.peerID)) continue;

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
        this.recordSupernodeFailure(supernode.capability.peerID);
      }
    }

    this.stats.localFallbacks++;
    return this.handleLocally(request);
  }

  private async getEligibleSupernodes(): Promise<ScoredSupernode[]> {
    const capabilities = await this.config.discovery.discoverSupernodes();
    const eligibleWithoutHealth = capabilities.filter((c) => !this.isBlocked(c.peerID));

    const peerIDs = eligibleWithoutHealth.map((c) => c.peerID);
    const healthMap = await this.config.healthSelector.fetchHealthMetrics(peerIDs);

    const statsMap = new Map<string, SupernodeStats>();
    for (const [peerID, health] of healthMap) {
      statsMap.set(peerID, {
        successRate: health.successRate,
        avgLatencyMs: health.avgLatencyMs,
        requestsServed24h: health.requestsServed24h,
      });
    }

    return rankSupernodes(eligibleWithoutHealth, healthMap, statsMap).slice(
      0,
      this.config.maxSupernodes
    );
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

  private async dialSupernode(peerID: string, request: DelegateRequest): Promise<DelegateResponse> {
    throw new Error('Not implemented: dialSupernode requires network adapter');
  }

  private async handleLocally(request: DelegateRequest): Promise<DelegateResponse> {
    const payload = request.payload;

    let resultPayload: Uint8Array;
    switch (request.service) {
      case 'embed': {
        const decoder = new TextDecoder();
        const req = JSON.parse(decoder.decode(payload));
        const embedding = await this.config.localHandler.handleEmbed(req.text, req.model);
        const encoder = new TextEncoder();
        resultPayload = encoder.encode(
          JSON.stringify({
            embedding,
            model: req.model,
            norm: Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)),
          })
        );
        break;
      }
      case 'ann_query': {
        const decoder = new TextDecoder();
        const req = JSON.parse(decoder.decode(payload));
        const matches = await this.config.localHandler.handleANN(req.query, req.k, req.modelHash);
        const encoder = new TextEncoder();
        resultPayload = encoder.encode(JSON.stringify({ matches, scores: [] }));
        break;
      }
      case 'sig_verify': {
        const decoder = new TextDecoder();
        const req = JSON.parse(decoder.decode(payload));
        const valid = await this.config.localHandler.handleSigVerify(
          req.payload,
          req.signature,
          req.publicKey
        );
        const encoder = new TextEncoder();
        resultPayload = encoder.encode(JSON.stringify({ valid }));
        break;
      }
      default:
        throw new Error('Unknown service');
    }

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
}
