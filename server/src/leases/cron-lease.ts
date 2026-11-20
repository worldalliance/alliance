import { LocksContext } from "@nestjs/locks";

/**
 * The key of each cron job's per-run lease. Two jobs share a key only when
 * they must never run at the same time.
 */
export enum CronLease {}

const locksContext = new LocksContext();

/**
 * Throws the loss reason once the leased run this is called in has lost its
 * lease, so the run takes no new item after another may have taken over. Does
 * nothing outside a leased run.
 */
export function assertLeaseHeld(): void {
  locksContext.signal?.throwIfAborted();
}
