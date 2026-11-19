import { LocksContext } from "@nestjs/locks";

/**
 * The key of each cron job's per-run lease. Two jobs share a key only when
 * they must never run at the same time.
 */
export enum CronLease {
  ActionEventNotifs = "cron:action-event-notifs",
  ContractReminders = "cron:contract-reminders",
  ContractSuspensions = "cron:contract-suspensions",
  ForumAutocomplete = "cron:forum-autocomplete",
  CohortDecisions = "cron:cohort-decisions",
  WaitlistEmails = "cron:waitlist-emails",
  RecognitionDelivery = "cron:recognition-delivery",
  TaskBadgeSweep = "cron:task-badge-sweep",
  ReloadUsersJoined = "cron:reload-users-joined",
  MmsMediaCopy = "cron:mms-media-copy",
}

const locksContext = new LocksContext();

/**
 * Throws the loss reason once the leased run this is called in has lost its
 * lease, so the run takes no new item after another may have taken over. Does
 * nothing outside a leased run.
 */
export function assertLeaseHeld(): void {
  locksContext.signal?.throwIfAborted();
}
