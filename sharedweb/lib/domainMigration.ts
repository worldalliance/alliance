import {
  ALLIANCE_LEGACY_DOMAIN as LEGACY_DOMAIN,
  ALLIANCE_DOMAIN as NEW_DOMAIN,
} from "@alliance/common/url";
import { addDays, addSeconds, isAfter } from "date-fns";

export { isLegacyAllianceHost as isLegacyDomain } from "@alliance/common/url";

const SNOOZE_KEY = "domain-migration-snoozed-at";
const SNOOZE_DAYS = 2;
const REDIRECT_KEY = "domain-migration-redirected";
const REDIRECT_WINDOW_SECONDS = 10;

type TargetLocation = {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
};

/**
 * The same page on the new domain, keeping any subdomain:
 * `staging.worldalliance.org/settings` becomes `staging.thealliance.org/settings`.
 * Only meaningful for a hostname {@link isLegacyDomain} accepts.
 */
export const newDomainUrl = (location: TargetLocation): string => {
  const subdomain = location.hostname.slice(0, -LEGACY_DOMAIN.length);
  return `https://${subdomain}${NEW_DOMAIN}${location.pathname}${location.search}${location.hash}`;
};

/**
 * Sends the browser to {@link newDomainUrl} and records the attempt for
 * {@link redirectAlreadyTried}. Throws rather than assigning a URL on the
 * origin already loaded. The browser reads that as a reload, and an effect
 * running on every load then has the reader in a loop with no way out.
 */
export const redirectToNewDomain = (
  target: TargetLocation,
  now: Date,
): void => {
  const url = newDomainUrl(target);
  if (new URL(url).origin === window.location.origin) {
    throw new Error(
      `${LEGACY_DOMAIN} and ${NEW_DOMAIN} both resolve to ${window.location.origin}, so the migration redirect would reload the same page`,
    );
  }
  window.sessionStorage.setItem(REDIRECT_KEY, String(now.getTime()));
  window.location.href = url;
};

/**
 * True when {@link redirectToNewDomain} ran in this tab within the last
 * {@link REDIRECT_WINDOW_SECONDS}. A hop that bounced back lands inside that
 * window. An old link opened later in the same tab is a fresh try and gets
 * redirected again.
 */
export const redirectAlreadyTried = (now: Date): boolean => {
  const stored = Number(window.sessionStorage.getItem(REDIRECT_KEY));
  if (!stored) return false;
  return isAfter(addSeconds(new Date(stored), REDIRECT_WINDOW_SECONDS), now);
};

export const isSnoozed = (now: Date): boolean => {
  const stored = Number(window.localStorage.getItem(SNOOZE_KEY));
  if (!stored) return false;
  return isAfter(addDays(new Date(stored), SNOOZE_DAYS), now);
};

export const snooze = (now: Date): void => {
  window.localStorage.setItem(SNOOZE_KEY, String(now.getTime()));
};
