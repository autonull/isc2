/* eslint-disable */
/**
 * Court system configuration constants
 */

export const COURT_CONFIG = {
  stores: {
    COURTS: 'courts',
    APPEALS: 'appeals',
    JURY: 'juries',
    VERDICTS: 'verdicts',
  },

  timing: {
    DEFAULT_VOTE_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours
    VERDICT_ANNOUNCEMENT_TTL: 86400 * 30, // 30 days
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
