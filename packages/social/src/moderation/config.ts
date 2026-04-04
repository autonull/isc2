/* eslint-disable */
/**
 * Court system configuration constants.
 * Store names are not here — those belong in the storage adapter.
 */

export const COURT_CONFIG = {
  timing: {
    DEFAULT_VOTE_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours
    VERDICT_ANNOUNCEMENT_TTL: 86400 * 30,           // 30 days (seconds)
  },

  jury: {
    MIN_JURORS: 3,
    MAX_JURORS: 9,
    DEFAULT_JUROR_COUNT: 5,
    DEFAULT_QUORUM: 0.6, // 60% of jurors must vote
  },

  dht: {
    APPEAL_PREFIX: '/isc/appeal',
    JURY_PREFIX: '/isc/jury',
    VERDICT_PREFIX: '/isc/verdict',
  },
} as const;
