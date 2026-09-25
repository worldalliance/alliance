import { isTimeZoneIdentifier } from "@alliance/common/timezone";

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The server refuses an invalid zone, so a failed detection sends `UTC` rather
 * than failing the signup.
 */
export function signupTimeZone(detected: string | undefined): string {
  return isTimeZoneIdentifier(detected) ? detected : "UTC";
}
