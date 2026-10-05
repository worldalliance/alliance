import { WaitlistEmailPlaceholder } from "@alliance/common/waitlistEmail";
import { waitlistShareLink } from "src/search/approutes";
import type { WaitlistEntry } from "./entities/waitlist-entry.entity";
import type { WaitlistEmailValues } from "./waitlist-email-render";
import { SPAM_LIKE } from "./waitlist-spam";

export enum WaitlistEmailSkipReason {
  Unsubscribed = "unsubscribed",
  InviteClaimed = "invite_claimed",
  Spam = "spam",
}

/** An entry staff selected, with whether an account claimed its invite. */
export type WaitlistEmailCandidate = { entry: WaitlistEntry; claimed: boolean };

/** Null when the entry gets the email. */
export function skipReason(params: {
  candidate: WaitlistEmailCandidate;
  includeClaimed: boolean;
}): WaitlistEmailSkipReason | null {
  const { candidate, includeClaimed } = params;
  if (candidate.entry.unsubscribedAt) {
    return WaitlistEmailSkipReason.Unsubscribed;
  }
  if (SPAM_LIKE[candidate.entry.spamStatus]) {
    return WaitlistEmailSkipReason.Spam;
  }
  if (candidate.claimed && !includeClaimed) {
    return WaitlistEmailSkipReason.InviteClaimed;
  }
  return null;
}

export const reachable = (
  candidates: WaitlistEmailCandidate[],
  includeClaimed: boolean,
): WaitlistEmailCandidate[] =>
  candidates.filter(
    (candidate) => skipReason({ candidate, includeClaimed }) === null,
  );

/** Needs the entry's organization loaded. */
export function waitlistEmailValues(params: {
  entry: WaitlistEntry;
  signupLink: string | null;
}): WaitlistEmailValues {
  const { entry, signupLink } = params;
  if (entry.organizationId !== null && !entry.organization) {
    throw new Error(`organization of waitlist entry ${entry.id} not loaded`);
  }
  return {
    [WaitlistEmailPlaceholder.Name]: entry.name,
    [WaitlistEmailPlaceholder.OrganizationName]:
      entry.organization?.name ?? null,
    [WaitlistEmailPlaceholder.SignupLink]: signupLink,
    [WaitlistEmailPlaceholder.PersonalShareLink]: waitlistShareLink(entry.code),
  };
}
