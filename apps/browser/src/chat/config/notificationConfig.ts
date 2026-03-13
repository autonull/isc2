/**
 * Chat Notifications Configuration
 */

export const NOTIFICATION_CONFIG = {
  display: {
    defaultTimeoutMs: 5000,
    maxTitleLength: 50,
    maxBodyLength: 200,
  },
  permissions: {
    requestOnFirstMessage: true,
    rememberDecision: true,
  },
  badges: {
    enabled: true,
    maxCount: 99,
  },
} as const;
