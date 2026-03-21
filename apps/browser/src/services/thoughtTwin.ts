import { getDB, dbGet, dbPut } from '../db/factory.js';
import { getTopSimilarPeers } from './peerProximity.js';

const SETTINGS_DB_NAME = 'isc-settings';
const SETTINGS_STORE = 'settings';
const THOUGHT_TWIN_KEY = 'lastThoughtTwinNotification';

interface ThoughtTwin {
  peerId: string;
  days: number;
  avgCosine: number;
  score: number;
}

interface ThoughtTwinNotification {
  twin: ThoughtTwin | null;
  shouldShow: boolean;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

async function getSettingsDB(): Promise<IDBDatabase> {
  return getDB({ name: SETTINGS_DB_NAME, version: 1, stores: [SETTINGS_STORE] });
}

export async function getThoughtTwin(): Promise<ThoughtTwin | null> {
  const topPeers = await getTopSimilarPeers(1);
  if (topPeers.length === 0) return null;

  const { peerId, days, score } = topPeers[0];
  return {
    peerId,
    days,
    avgCosine: score / Math.max(1, days),
    score,
  };
}

export async function shouldShowThoughtTwinNotification(): Promise<ThoughtTwinNotification> {
  try {
    // I2: Respect user preference - check if ThoughtTwin notifications are disabled
    const settingsDisabled = localStorage.getItem('isc:disable-thoughttwin') === 'true';
    if (settingsDisabled) {
      return { twin: null, shouldShow: false };
    }

    const db = await getSettingsDB();
    const settings = await dbGet<{ value: number }>(db, SETTINGS_STORE, THOUGHT_TWIN_KEY);
    const now = Date.now();

    if (!settings?.value || now - settings.value > MS_PER_WEEK) {
      const twin = await getThoughtTwin();
      if (twin && twin.days >= 3) {
        return { twin, shouldShow: true };
      }
    }

    return { twin: null, shouldShow: false };
  } catch {
    return { twin: null, shouldShow: false };
  }
}

export async function acknowledgeThoughtTwin(): Promise<void> {
  try {
    const db = await getSettingsDB();
    await dbPut(db, SETTINGS_STORE, { id: THOUGHT_TWIN_KEY, value: Date.now() });
  } catch (err) {
    console.warn('[ThoughtTwin] Failed to save acknowledgment:', err);
  }
}

export async function dismissThoughtTwin(): Promise<void> {
  await acknowledgeThoughtTwin();
}

export const thoughtTwinService = {
  getThoughtTwin,
  shouldShowThoughtTwinNotification,
  acknowledgeThoughtTwin,
  dismissThoughtTwin,
};

export default thoughtTwinService;
