import { isTimeZoneIdentifier } from "@alliance/common/timezone";

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The server refuses an invalid zone, so a failed detection sends `null` rather
 * than failing the signup, and backfill fills the zone in on a later session.
 */
export function signupTimeZone(detected: string | undefined): string | null {
  return isTimeZoneIdentifier(detected) ? detected : null;
}

export function formTimeZoneDefault(zones: {
  saved: string | null | undefined;
  device: string | undefined;
}): string | undefined {
  return [zones.saved, zones.device].find(isTimeZoneIdentifier);
}
