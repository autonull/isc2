/* eslint-disable */
/**
 * Court Session Service
 *
 * Manages court sessions and aggregates statistics.
 */

import type { CourtSession, CourtStats } from './types.js';
import type { ModerationStorage } from './adapters.js';

export interface SessionService {
  start(councilId: string): Promise<CourtSession>;
  get(sessionId: string): Promise<CourtSession | null>;
  addAppeal(sessionId: string, appealId: string): Promise<void>;
  completeAppeal(sessionId: string, appealId: string): Promise<void>;
  end(sessionId: string): Promise<void>;
  getStats(councilId: string): Promise<CourtStats>;
}

export function createSessionService(storage: ModerationStorage): SessionService {
  return {
    async start(councilId) {
      const session: CourtSession = {
        id: `session_${crypto.randomUUID()}`,
        councilId,
        activeAppeals: [],
        completedAppeals: [],
        startedAt: Date.now(),
      };
      await storage.saveSession(session);
      return session;
    },

    async get(sessionId) {
      return storage.getSession(sessionId);
    },

    async addAppeal(sessionId, appealId) {
      const session = await storage.getSession(sessionId);
      if (!session || session.activeAppeals.includes(appealId)) {return;}
      await storage.saveSession({
        ...session,
        activeAppeals: [...session.activeAppeals, appealId],
      });
    },

    async completeAppeal(sessionId, appealId) {
      const session = await storage.getSession(sessionId);
      if (!session) {return;}
      await storage.saveSession({
        ...session,
        activeAppeals: session.activeAppeals.filter((id) => id !== appealId),
        completedAppeals: [...session.completedAppeals, appealId],
      });
    },

    async end(sessionId) {
      const session = await storage.getSession(sessionId);
      if (!session) {return;}
      await storage.saveSession({ ...session, endedAt: Date.now() });
    },

    async getStats(_councilId) {
      const [appeals, verdicts] = await Promise.all([
        storage.filterAppeals(() => true),
        storage.getAllVerdicts(),
      ]);

      const pending = appeals.filter((a) => a.status === 'pending').length;
      const completed = appeals.filter((a) => a.status === 'decided').length;

      const resolutionTimes = verdicts.map((v) => {
        const appeal = appeals.find((a) => a.id === v.appealId);
        return appeal ? v.decidedAt - appeal.timestamp : 0;
      });

      const averageResolutionTime =
        resolutionTimes.length > 0
          ? resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length
          : 0;

      const overturnCount = verdicts.filter((v) => v.decision === 'overturn').length;

      return {
        totalAppeals: appeals.length,
        pendingAppeals: pending,
        completedAppeals: completed,
        averageResolutionTime,
        overturnRate: verdicts.length > 0 ? overturnCount / verdicts.length : 0,
      };
    },
  };
}
