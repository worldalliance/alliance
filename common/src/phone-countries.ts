// Keep picker data separate so parser and display imports omit generated names
// and the table built at module initialization.
import {
  type CountryCode,
  getCountries,
  getCountryCallingCode,
} from "libphonenumber-js/max";
import { COUNTRY_NAMES } from "./country-names";
import { R } from "./result";

export type PhoneCountry = {
  country: CountryCode;
  callingCode: string;
  name: string;
  flag: string;
};

export function countryFlagEmoji(country: string): string {
  const REGIONAL_INDICATOR_A = 0x1f1e6;
  return String.fromCodePoint(
    ...[...country.toUpperCase()].map(
      (letter) =>
        REGIONAL_INDICATOR_A + letter.charCodeAt(0) - "A".charCodeAt(0),
    ),
  );
}

/**
 * Display metadata for one country, degrading rather than throwing.
 *
 * `COUNTRY_NAMES` is generated and checked in, so a `libphonenumber-js` bump
 * that adds a territory leaves a country the table cannot name. This is built
 * at module initialization and read during render, so throwing there would
 * white-screen every page importing the picker — over a missing label. Falling
 * back to the ISO code keeps that a cosmetic defect; the "names every country
 * the parser knows" test fails on the skew, so it cannot ship unnoticed.
 */
function phoneCountry(country: CountryCode): PhoneCountry {
  return {
    country,
    callingCode: R.unwrapOr(
      R.fromThrowable((): string => getCountryCallingCode(country)),
      "",
    ),
    name: COUNTRY_NAMES[country] ?? country,
    flag: countryFlagEmoji(country),
  };
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = getCountries()
  .map(phoneCountry)
  .sort((a, b) => a.name.localeCompare(b.name));

/** Matches country name, exact ISO code, or dialing-code prefix. */
export function filterPhoneCountries(query: string): readonly PhoneCountry[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return PHONE_COUNTRIES;
  }
  const digits = trimmed.replace(/\D/g, "");
  return PHONE_COUNTRIES.filter(
    (entry) =>
      entry.name.toLowerCase().includes(trimmed) ||
      entry.country.toLowerCase() === trimmed ||
      (digits !== "" && entry.callingCode.startsWith(digits)),
  );
}

const PHONE_COUNTRY_BY_CODE = new Map(
  PHONE_COUNTRIES.map((entry) => [entry.country, entry]),
);

export function phoneCountryInfo(country: CountryCode): PhoneCountry {
  return PHONE_COUNTRY_BY_CODE.get(country) ?? phoneCountry(country);
}
