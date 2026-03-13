/**
 * ICE Server Manager Service
 *
 * Manages STUN/TURN server configuration for WebRTC.
 */

import type { TURNConfig, STUNConfig } from '../types/relay.js';
import { DEFAULT_STUN_SERVERS, DEFAULT_TURN_SERVERS } from '../config/relayConfig.js';

export class ICEServerManager {
  private turnServers: TURNConfig[];
  private stunServers: STUNConfig[];

  constructor(
    turnServers: TURNConfig[] = DEFAULT_TURN_SERVERS,
    stunServers: STUNConfig[] = DEFAULT_STUN_SERVERS
  ) {
    this.turnServers = [...turnServers];
    this.stunServers = [...stunServers];
  }

  /**
   * Get all ICE servers as RTCIceServer array
   */
  getICEServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [];

    for (const stun of this.stunServers) {
      servers.push({ urls: stun.urls });
    }

    for (const turn of this.turnServers) {
      servers.push({
        urls: turn.urls,
        username: turn.username,
        credential: turn.credential,
      });
    }

    return servers;
  }

  /**
   * Add TURN server
   */
  addTurnServer(turn: TURNConfig): void {
    this.turnServers.push(turn);
  }

  /**
   * Add STUN server
   */
  addStunServer(stun: STUNConfig): void {
    this.stunServers.push(stun);
  }

  /**
   * Get TURN servers
   */
  getTurnServers(): TURNConfig[] {
    return [...this.turnServers];
  }

  /**
   * Get STUN servers
   */
  getStunServers(): STUNConfig[] {
    return [...this.stunServers];
  }

  /**
   * Clear all servers
   */
  clear(): void {
    this.turnServers = [];
    this.stunServers = [];
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.turnServers = [...DEFAULT_TURN_SERVERS];
    this.stunServers = [...DEFAULT_STUN_SERVERS];
  }
}
