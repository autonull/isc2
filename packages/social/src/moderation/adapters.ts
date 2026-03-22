/**
 * Moderation Adapter Interfaces
 *
 * Inject platform-specific storage, identity, network, reputation, and council
 * lookups into the moderation services. The business logic has no knowledge of
 * IndexedDB, DelegationClient, or any other browser/node primitive.
 */

import type {
  AppealCase,
  Jury,
  Verdict,
  CourtSession,
  Council,
} from './types.js';

export interface ModerationStorage {
  // Appeals
  getAppeal(id: string): Promise<AppealCase | null>;
  saveAppeal(appeal: AppealCase): Promise<void>;
  filterAppeals(pred: (a: AppealCase) => boolean): Promise<AppealCase[]>;

  // Juries
  getJury(id: string): Promise<Jury | null>;
  saveJury(jury: Jury): Promise<void>;
  filterJuries(pred: (j: Jury) => boolean): Promise<Jury[]>;
  getAllJuries(): Promise<Jury[]>;

  // Verdicts
  getVerdict(id: string): Promise<Verdict | null>;
  saveVerdict(verdict: Verdict): Promise<void>;
  getAllVerdicts(): Promise<Verdict[]>;

  // Sessions
  getSession(id: string): Promise<CourtSession | null>;
  saveSession(session: CourtSession): Promise<void>;
}

export interface ModerationIdentity {
  getPeerId(): Promise<string>;
  /** Signs a payload and returns the raw signature bytes */
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

export interface ModerationNetwork {
  announce(key: string, value: Uint8Array, ttlSeconds: number): Promise<void>;
}

export interface ModerationReputation {
  /** Returns a 0–1 score for the given peer */
  getScore(peerId: string): Promise<number>;
}

export interface CouncilProvider {
  getCouncil(councilId: string): Promise<Council | null>;
  isEligible(memberId: string, reputationThreshold: number): Promise<boolean>;
}
