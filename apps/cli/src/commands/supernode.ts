/**
 * Supernode Command
 *
 * Starts a supernode that handles delegation requests from low-tier peers
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { cosineSimilarity, sampleFromDistribution } from '@isc/core';
import type { CLIConfig } from '../config.js';
import type { DelegateRequest, DelegateResponse } from '@isc/core';

const MAX_CONCURRENT_REQUESTS = 10;
const DELEGATION_RATE_LIMIT = 3; // per minute per peer
const RATE_WINDOW_MS = 60000;

interface SupernodeState {
  activeRequests: number;
  totalRequestsServed: number;
  startTime: number;
  uptime: number;
  rateLimits: Map<string, number[]>;
}

interface DelegationCapabilities {
  canEmbed: boolean;
  canMatch: boolean;
  canSample: boolean;
  model: string;
  maxConcurrent: number;
}

function getRateLimitForPeer(state: SupernodeState, peerID: string): { allowed: boolean; retryAfter?: number } {
  const timestamps = state.rateLimits.get(peerID) || [];
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  
  const validTimestamps = timestamps.filter(ts => ts > windowStart);
  
  if (validTimestamps.length >= DELEGATION_RATE_LIMIT) {
    const oldestInWindow = Math.min(...validTimestamps);
    const retryAfter = Math.ceil((oldestInWindow + RATE_WINDOW_MS - now) / 1000);
    state.rateLimits.set(peerID, validTimestamps);
    return { allowed: false, retryAfter };
  }
  
  validTimestamps.push(now);
  state.rateLimits.set(peerID, validTimestamps);
  return { allowed: true };
}

async function computeEmbedding(text: string): Promise<number[]> {
  // Stub embedding - in production would use transformers.js or ONNX
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hashBytes = new Uint8Array(hash);
  const vec = new Array(384).fill(0).map((_, i) => {
    const byte = hashBytes[i % 32];
    return (byte / 255) * 2 - 1;
  });
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map(v => v / norm);
}

async function handleDelegationRequest(
  request: DelegateRequest,
  state: SupernodeState
): Promise<DelegateResponse> {
  state.activeRequests++;
  
  try {
    let result: unknown;
    
    switch (request.operation) {
      case 'embed': {
        const text = request.payload as string;
        result = await computeEmbedding(text);
        break;
      }
      
      case 'match': {
        const { vec1, vec2 } = request.payload as { vec1: number[]; vec2: number[] };
        result = cosineSimilarity(vec1, vec2);
        break;
      }
      
      case 'sample': {
        const { mu, sigma, n } = request.payload as { mu: number[]; sigma: number; n: number };
        result = sampleFromDistribution(mu, sigma, n);
        break;
      }
      
      default:
        throw new Error(`Unknown operation: ${request.operation}`);
    }
    
    state.totalRequestsServed++;
    
    return {
      requestId: request.id,
      result,
      timestamp: Date.now(),
      signature: new Uint8Array() // Would sign in production
    };
  } finally {
    state.activeRequests--;
  }
}

function createSupernodeServer(
  config: CLIConfig,
  state: SupernodeState,
  port: number
): http.Server {
  const capabilities: DelegationCapabilities = {
    canEmbed: true,
    canMatch: true,
    canSample: true,
    model: 'Xenova/all-MiniLM-L6-v2',
    maxConcurrent: MAX_CONCURRENT_REQUESTS
  };

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        activeRequests: state.activeRequests,
        totalServed: state.totalRequestsServed,
        uptime: Math.floor((Date.now() - state.startTime) / 1000)
      }));
      return;
    }

    // Capabilities
    if (req.method === 'GET' && req.url === '/capabilities') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(capabilities));
      return;
    }

    // Delegation request
    if (req.method === 'POST' && req.url === '/delegate') {
      // Check concurrent limit
      if (state.activeRequests >= MAX_CONCURRENT_REQUESTS) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'RATE_LIMITED',
          message: 'Too many concurrent requests',
          retryAfter: 5
        }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const request: DelegateRequest = JSON.parse(body);
          
          // Check per-peer rate limit
          const peerID = request.id; // Use request ID as peer identifier
          const rateCheck = getRateLimitForPeer(state, peerID);
          
          if (!rateCheck.allowed) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'RATE_LIMITED',
              message: 'Rate limit exceeded',
              retryAfter: rateCheck.retryAfter
            }));
            return;
          }

          // Handle request
          const response = await handleDelegationRequest(request, state);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      });
      return;
    }

    // 404
    res.writeHead(404);
    res.end('Not Found');
  });

  return server;
}

export function supernodeCommands(program: Command): void {
  const supernode = program.command('supernode')
    .description('Supernode operations')
    .alias('sn');

  // Start supernode
  supernode
    .command('start')
    .description('Start a supernode to handle delegation requests')
    .option('-p, --port <number>', 'Port to listen on', '3000')
    .option('--max-concurrent <number>', 'Max concurrent requests', '10')
    .action((options: { port: string; maxConcurrent: string }) => {
      try {
        const config = (program as any).config as CLIConfig;
        const port = parseInt(options.port);
        const maxConcurrent = parseInt(options.maxConcurrent);

        const state: SupernodeState = {
          activeRequests: 0,
          totalRequestsServed: 0,
          startTime: Date.now(),
          uptime: 0,
          rateLimits: new Map()
        };

        const server = createSupernodeServer(config, state, port);

        server.listen(port, () => {
          console.log('\n✓ Supernode started\n');
          console.log(`  Port: ${port}`);
          console.log(`  Max concurrent: ${maxConcurrent}`);
          console.log(`  Model: Xenova/all-MiniLM-L6-v2`);
          console.log(`  Rate limit: ${DELEGATION_RATE_LIMIT}/min per peer`);
          console.log('\nEndpoints:');
          console.log(`  GET  /health       - Health check`);
          console.log(`  GET  /capabilities - Delegation capabilities`);
          console.log(`  POST /delegate     - Delegation requests`);
          console.log('\nPress Ctrl+C to stop\n');
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
          console.log('\nShutting down supernode...');
          server.close(() => {
            console.log('Supernode stopped');
            process.exit(0);
          });
        });

      } catch (error) {
        console.error('Failed to start supernode:', error);
        process.exit(1);
      }
    });

  // Show supernode status
  supernode
    .command('status')
    .description('Show supernode status')
    .action(async () => {
      try {
        const config = (program as any).config as CLIConfig;
        
        // Try to connect to local supernode
        const healthUrl = `http://localhost:${config.supernodeUrl?.split(':').pop() || '3000'}/health`;
        
        try {
          const response = await fetch(healthUrl);
          if (response.ok) {
            const health = await response.json() as { status: string; activeRequests: number; totalServed: number; uptime: number };
            
            console.log('\nSupernode Status\n');
            console.log(`  Status: ${health.status}`);
            console.log(`  Active requests: ${health.activeRequests}`);
            console.log(`  Total served: ${health.totalServed}`);
            console.log(`  Uptime: ${health.uptime}s`);
            console.log();
            return;
          }
        } catch {
          // Supernode not running
        }

        console.log('\nSupernode Status\n');
        console.log('  Status: Not running');
        console.log('  Start with: isc supernode start');
        console.log();

      } catch (error) {
        console.error('Failed to get supernode status:', error);
        process.exit(1);
      }
    });

  // Test delegation
  supernode
    .command('test')
    .description('Test delegation endpoint')
    .option('--operation <op>', 'Operation to test', 'embed')
    .action(async (options: { operation: string }) => {
      try {
        const config = (program as any).config as CLIConfig;
        const port = config.supernodeUrl?.split(':').pop() || '3000';
        const baseUrl = `http://localhost:${port}`;

        let payload: DelegateRequest;
        
        switch (options.operation) {
          case 'embed':
            payload = {
              id: 'test-' + Date.now(),
              operation: 'embed',
              payload: 'Test embedding for delegation',
              timestamp: Date.now(),
              signature: new Uint8Array()
            };
            break;
          case 'match':
            payload = {
              id: 'test-' + Date.now(),
              operation: 'match',
              payload: {
                vec1: new Array(384).fill(0).map(() => Math.random()),
                vec2: new Array(384).fill(0).map(() => Math.random())
              },
              timestamp: Date.now(),
              signature: new Uint8Array()
            };
            break;
          case 'sample':
            payload = {
              id: 'test-' + Date.now(),
              operation: 'sample',
              payload: {
                mu: new Array(384).fill(0).map(() => Math.random()),
                sigma: 0.1,
                n: 10
              },
              timestamp: Date.now(),
              signature: new Uint8Array()
            };
            break;
          default:
            console.error(`Unknown operation: ${options.operation}`);
            process.exit(1);
        }

        const response = await fetch(`${baseUrl}/delegate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Delegation failed:', error);
          process.exit(1);
        }

        const result = await response.json() as DelegateResponse;
        
        console.log('\n✓ Delegation test successful\n');
        console.log(`  Operation: ${options.operation}`);
        console.log(`  Request ID: ${result.requestId}`);
        console.log(`  Timestamp: ${new Date(result.timestamp).toISOString()}`);
        
        if (options.operation === 'embed') {
          const vec = result.result as number[];
          console.log(`  Result: ${vec.length}-dim vector`);
          console.log(`  Norm: ${Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)).toFixed(4)}`);
        } else if (options.operation === 'match') {
          console.log(`  Result: ${result.result}`);
        } else if (options.operation === 'sample') {
          const samples = result.result as number[][];
          console.log(`  Result: ${samples.length} samples`);
        }
        console.log();

      } catch (error) {
        console.error('Delegation test failed:', error);
        console.log('\nMake sure supernode is running: isc supernode start\n');
        process.exit(1);
      }
    });
}
