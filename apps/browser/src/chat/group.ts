import { cosineSimilarity } from '@isc/core';

export interface GroupMember {
  peerId: string;
  channelId: string;
}

export interface GroupRoom {
  id: string;
  members: string[];
  createdAt: number;
  initiator: string;
}

export interface GroupConfig {
  similarityThreshold?: number;
  minMembers?: number;
  maxMembers?: number;
  getPeerId: () => string;
}

const DEFAULT_CONFIG = {
  similarityThreshold: 0.85,
  minMembers: 3,
  maxMembers: 8,
};

export class GroupFormation {
  private config: Required<GroupConfig>;

  constructor(config: GroupConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<GroupConfig>;
  }

  detectDenseCluster(candidates: { peerId: string; vec: number[] }[]): string[][] {
    if (candidates.length < this.config.minMembers) return [];

    const n = candidates.length;
    const adjacency: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sim = cosineSimilarity(candidates[i].vec, candidates[j].vec);
        adjacency[i][j] = adjacency[j][i] = sim > this.config.similarityThreshold;
      }
    }

    const visited = new Set<number>();
    const clusters: string[][] = [];

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;

      const cluster: number[] = [i];
      visited.add(i);

      const queue = [i];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (let j = 0; j < n; j++) {
          if (!visited.has(j) && adjacency[current][j]) {
            visited.add(j);
            cluster.push(j);
            queue.push(j);
          }
        }
      }

      if (cluster.length >= this.config.minMembers) {
        clusters.push(cluster.map((idx) => candidates[idx].peerId));
      }
    }

    return clusters;
  }

  selectInitiator(memberIds: string[]): string {
    return [...memberIds].sort().pop()!;
  }

  async createGroupInvite(
    roomId: string,
    members: string[],
    _initiatorPeerId: string,
    signingKey: CryptoKey
  ): Promise<GroupInvite> {
    const timestamp = Date.now();
    const payload = JSON.stringify({
      roomID: roomId,
      members,
      timestamp,
    });

    const signature = await crypto.subtle.sign(
      { name: 'Ed25519' },
      signingKey,
      new TextEncoder().encode(payload)
    );

    return {
      type: 'group_invite',
      roomID: roomId,
      members,
      timestamp,
      signature: new Uint8Array(signature),
    };
  }

  async verifyGroupInvite(invite: GroupInvite): Promise<boolean> {
    const initiator = this.selectInitiator(invite.members);
    const payload = JSON.stringify({
      roomID: invite.roomID,
      members: invite.members,
      timestamp: invite.timestamp,
    });

    const keyData = new Uint8Array(32);
    keyData.set(
      initiator
        .slice(0, 32)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    try {
      const key = await crypto.subtle.importKey(
        'raw',
        keyData.buffer as ArrayBuffer,
        { name: 'Ed25519' },
        true,
        ['verify']
      );

      return await crypto.subtle.verify(
        { name: 'Ed25519' },
        key,
        invite.signature.buffer as ArrayBuffer,
        new TextEncoder().encode(payload)
      );
    } catch {
      return false;
    }
  }

  createRoomId(): string {
    return `room_${crypto.randomUUID()}`;
  }

  calculateDrift(memberVec: number[], peerVecs: Map<string, number[]>): number {
    let avgSimilarity = 0;
    let count = 0;

    for (const [, vec] of peerVecs) {
      avgSimilarity += cosineSimilarity(memberVec, vec);
      count++;
    }

    return count > 0 ? avgSimilarity / count : 0;
  }

  shouldExit(drift: number): boolean {
    return drift < 0.55;
  }
}

export interface GroupInvite {
  type: 'group_invite';
  roomID: string;
  members: string[];
  timestamp: number;
  signature: Uint8Array;
}
