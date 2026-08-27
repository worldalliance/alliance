import { getCountryForTimezone } from "countries-and-timezones";

export enum UsMembership {
  Us = "us",
  NonUs = "non_us",
  Unknown = "unknown",
}

const US_COUNTRY_CODE = "US";

/**
 * Where a member counts as living. The city on their profile decides it; for
 * members without one, the country owning their time zone does. A typed-in
 * `customCityString` is not a city here. Territories carry their own country
 * codes and zones (PR, GU, …), so they resolve to NonUs.
 *
 * Unknown means we can't place the member: no city, and either no time zone or
 * one no country claims (UTC). Those members belong to neither country cohort.
 *
 * The zone is a guess, not a country. A member who picks one from a country
 * they don't live in reads as that country, and profiles written before the
 * picker offered Canadian zones can still carry a US one.
 */
export function resolveUsMembership(params: {
  countryCode: string | null | undefined;
  timeZone: string | null | undefined;
}): UsMembership {
  const { countryCode, timeZone } = params;
  if (countryCode) {
    return countryCode.toUpperCase() === US_COUNTRY_CODE
      ? UsMembership.Us
      : UsMembership.NonUs;
  }
  const zoneCountry = timeZone ? getCountryForTimezone(timeZone) : null;
  if (!zoneCountry) return UsMembership.Unknown;
  return zoneCountry.id === US_COUNTRY_CODE
    ? UsMembership.Us
    : UsMembership.NonUs;
}
