/**
 * PostgreSQL advisory lock keys for cron workers.
 * Each pair must be unique unless workers intentionally share a lock
 * to prevent concurrent execution.
 */
export const LOCK_KEYS = {
  actionEventNotif: [0xa11a, 0xce01] as const,
  contractSuspender: [0xa11a, 0xce03] as const,
  contractReminder: [0xa11a, 0xce02] as const,
  forumActionCompleter: [0xf0a1, 0xace1] as const,
};
