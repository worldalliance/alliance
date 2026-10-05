import { WaitlistSpamStatus } from "./entities/waitlist-entry.entity";

/** Spam-like entries get no email and drop out of public counts. */
export const SPAM_LIKE: Record<WaitlistSpamStatus, boolean> = {
  [WaitlistSpamStatus.Clean]: false,
  [WaitlistSpamStatus.Suspected]: true,
  [WaitlistSpamStatus.Spam]: true,
  [WaitlistSpamStatus.NotSpam]: false,
};

export const SPAM_LIKE_STATUSES = Object.values(WaitlistSpamStatus).filter(
  (status) => SPAM_LIKE[status],
);

/** Suspects a reason that is one run of 12+ ASCII letters with 3+ capitals
 * after the first, the shape a signup bot sends. */
export function detectSpamStatus(reason: string | null): WaitlistSpamStatus {
  const trimmed = reason?.trim() ?? "";
  const randomToken =
    /^[A-Za-z]{12,}$/.test(trimmed) &&
    (trimmed.slice(1).match(/[A-Z]/g)?.length ?? 0) >= 3;
  return randomToken ? WaitlistSpamStatus.Suspected : WaitlistSpamStatus.Clean;
}
