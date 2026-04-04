/* eslint-disable */
import type { DelegateRequest, DelegateResponse } from '@isc/protocol';
import { EmbedService } from './services/embed.js';
import { ANNService } from './services/ann.js';
import { SigVerifyService } from './services/verify.js';

class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    const value = this.cache.get(key);
    if (value === undefined) return undefined;

    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const iterator = this.cache.keys();
      const firstResult = iterator.next();
      if (!firstResult.done && firstResult.value !== undefined) {
        this.cache.delete(firstResult.value);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export interface DelegationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencies: number[];
  requestsServed24h: number;
}

export class SupernodeHandler {
  private embedService: EmbedService;
  private annService: ANNService;
  private sigVerifyService: SigVerifyService;
  private privateKey: CryptoKey;
  publicKey: Uint8Array;
  private metrics: DelegationMetrics;
  private requestTimestamps: number[] = [];
  private seenRequestIDs: LRUCache<string, number> = new LRUCache(1000);
  private maxConcurrent: number;
  private currentRequests: number = 0;

  constructor(
    embedService: EmbedService,
    annService: ANNService,
    sigVerifyService: SigVerifyService,
    privateKey: CryptoKey,
    publicKey: Uint8Array,
    maxConcurrent: number = 5
  ) {
    this.embedService = embedService;
    this.annService = annService;
    this.sigVerifyService = sigVerifyService;
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.maxConcurrent = maxConcurrent;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      latencies: [],
      requestsServed24h: 0,
    };
  }

  async handleRequest(request: DelegateRequest): Promise<DelegateResponse> {
    const startTime = Date.now();

    if (this.currentRequests >= this.maxConcurrent) {
      throw new Error('RATE_LIMITED: max concurrent requests exceeded');
    }

    if (!this.isRequestValid(request)) {
      throw new Error('INVALID_REQUEST: validation failed');
    }

    this.currentRequests++;

    try {
      const payload = this.decryptPayload(request.payload);

      let servicePayload: Uint8Array;
      switch (request.service) {
        case 'embed':
          servicePayload = await this.embedService.handleRequest(payload);
          break;
        case 'ann_query':
          servicePayload = await this.annService.handleRequest(payload);
          break;
        case 'sig_verify':
          servicePayload = await this.sigVerifyService.handleRequest(payload);
          break;
        default:
          throw new Error(`Unknown service: ${request.service}`);
      }

      const response: DelegateResponse = {
        type: 'delegate_response',
        requestID: request.requestID,
        service: request.service,
        payload: servicePayload,
        responderPubKey: this.publicKey,
        timestamp: Date.now(),
        signature: new Uint8Array(),
      };

      response.signature = await this.signResponse(response);

      this.recordSuccess(startTime);
      return response;
    } catch (error) {
      this.recordFailure(startTime);
      throw error;
    } finally {
      this.currentRequests--;
    }
  }

  private isRequestValid(request: DelegateRequest): boolean {
    if (request.type !== 'delegate_request') return false;
    if (!request.requestID || !request.service) return false;
    if (!request.payload || !(request.payload instanceof Uint8Array)) return false;
    if (!request.requesterPubKey || !(request.requesterPubKey instanceof Uint8Array)) return false;
    if (!request.timestamp || Date.now() - request.timestamp > 30000) return false;
    if (this.seenRequestIDs.has(request.requestID)) return false;

    this.seenRequestIDs.set(request.requestID, Date.now());
    return true;
  }

  private decryptPayload(encryptedPayload: Uint8Array): Uint8Array {
    return encryptedPayload;
  }

  private async signResponse(response: DelegateResponse): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(
      JSON.stringify({
        type: response.type,
        requestID: response.requestID,
        service: response.service,
        payload: Array.from(response.payload),
        responderPubKey: Array.from(response.responderPubKey),
        timestamp: response.timestamp,
      })
    );

    const signature = await crypto.subtle.sign({ name: 'Ed25519' }, this.privateKey, data);
    return new Uint8Array(signature);
  }

  private recordSuccess(startTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.requestsServed24h++;
    this.metrics.latencies.push(Date.now() - startTime);
    this.requestTimestamps.push(Date.now());
    this.cleanupOldTimestamps();
  }

  private recordFailure(startTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.latencies.push(Date.now() - startTime);
    this.requestTimestamps.push(Date.now());
    this.cleanupOldTimestamps();
  }

  private cleanupOldTimestamps(): void {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > dayAgo);
    this.metrics.requestsServed24h = this.requestTimestamps.length;
    this.metrics.latencies = this.metrics.latencies.slice(-100);
  }

  getMetrics(): DelegationMetrics {
    return { ...this.metrics };
  }

  getSuccessRate(): number {
    return this.metrics.totalRequests === 0 ? 0 : this.metrics.successfulRequests / this.metrics.totalRequests;
  }

  getAvgLatency(): number {
    return this.metrics.latencies.length === 0 ? 0 : this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length;
  }
}
