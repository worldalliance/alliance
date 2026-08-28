import { addDays, isAfter } from "date-fns";

const LEGACY_DOMAIN = "worldalliance.org";
const NEW_DOMAIN = "thealliance.org";

const SNOOZE_KEY = "domain-migration-snoozed-at";
const SNOOZE_DAYS = 5;

export const isLegacyDomain = (hostname: string): boolean =>
  hostname === LEGACY_DOMAIN || hostname.endsWith(`.${LEGACY_DOMAIN}`);

/**
 * The same page on the new domain, keeping any subdomain:
 * `staging.worldalliance.org/settings` becomes `staging.thealliance.org/settings`.
 * Only meaningful for a hostname {@link isLegacyDomain} accepts.
 */
export const newDomainUrl = (location: {
  hostname: string;
  pathname: string;
  search: string;
}): string => {
  const subdomain = location.hostname.slice(0, -LEGACY_DOMAIN.length);
  return `https://${subdomain}${NEW_DOMAIN}${location.pathname}${location.search}`;
};

export const isSnoozed = (now: Date): boolean => {
  const stored = Number(window.localStorage.getItem(SNOOZE_KEY));
  if (!stored) return false;
  return isAfter(addDays(new Date(stored), SNOOZE_DAYS), now);
};

export const snooze = (now: Date): void => {
  window.localStorage.setItem(SNOOZE_KEY, String(now.getTime()));
};
