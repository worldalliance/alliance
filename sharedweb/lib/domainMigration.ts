import {
  ALLIANCE_LEGACY_DOMAIN as LEGACY_DOMAIN,
  ALLIANCE_DOMAIN as NEW_DOMAIN,
  hostnameMatchesDomain,
} from "@alliance/common/url";
import { addDays, isAfter } from "date-fns";

const SNOOZE_KEY = "domain-migration-snoozed-at";
const SNOOZE_DAYS = 5;

export const isLegacyDomain = (hostname: string): boolean =>
  hostnameMatchesDomain(hostname, LEGACY_DOMAIN);

/**
 * The same page on the new domain, keeping any subdomain:
 * `staging.worldalliance.org/settings` becomes `staging.thealliance.org/settings`.
 * Only meaningful for a hostname {@link isLegacyDomain} accepts.
 */
export const newDomainUrl = (location: {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
}): string => {
  const subdomain = location.hostname.slice(0, -LEGACY_DOMAIN.length);
  return `https://${subdomain}${NEW_DOMAIN}${location.pathname}${location.search}${location.hash}`;
};

export const isSnoozed = (now: Date): boolean => {
  const stored = Number(window.localStorage.getItem(SNOOZE_KEY));
  if (!stored) return false;
  return isAfter(addDays(new Date(stored), SNOOZE_DAYS), now);
};

export const snooze = (now: Date): void => {
  window.localStorage.setItem(SNOOZE_KEY, String(now.getTime()));
};
