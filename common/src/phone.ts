// Max metadata validates patterns; default metadata mainly checks length.
import {
  type CountryCode,
  isSupportedCountry,
  parsePhoneNumberWithError,
} from "libphonenumber-js/max";
import { R, type Result } from "./result";

export type { CountryCode };

/** Fallback for unqualified numbers; member inputs should pass a country. */
export const DEFAULT_PHONE_COUNTRY = "US" satisfies CountryCode;

export function asCountryCode(
  code: string | null | undefined,
): CountryCode | null {
  if (!code) {
    return null;
  }
  const upper = code.toUpperCase();
  return isSupportedCountry(upper) ? upper : null;
}

export type PhoneNumberError = "empty" | "invalid";

export function toE164(
  input: string,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): Result<string, PhoneNumberError> {
  const trimmed = input.trim();
  if (!trimmed) {
    return R.failure("empty");
  }

  const parsed = R.fromThrowable(() =>
    parsePhoneNumberWithError(trimmed, country),
  );
  if (R.isFailure(parsed) || !parsed.value.isValid()) {
    return R.failure("invalid");
  }

  return R.success(parsed.value.number);
}

/** Returns E.164 when the number parses, otherwise the input unchanged. */
export function normalizePhoneNumber(
  value: string,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  return R.unwrapOr(toE164(value, country), value);
}

/** Exact E.164 only; `+`-prefixed numbers need no default country. */
export function isCanonicalE164(value: string): boolean {
  return R.unwrapOr(toE164(value), null) === value;
}

const PHONE_SEPARATOR = String.raw`[\s()./\p{Pd}\u2212]`;
const PHONE_EXTENSION = String.raw`(?:ext\.?|x|#)\s*\d+`;
// Each digit has one place to match, so a failing match stays linear.
const PHONE_LIKE = new RegExp(
  String.raw`^\+?(?:${PHONE_SEPARATOR}*\d)+${PHONE_SEPARATOR}*(?:${PHONE_EXTENSION})?$`,
  "iu",
);
const NUMBER_BEFORE_EXTENSION = new RegExp(
  String.raw`^(.*\d)${PHONE_SEPARATOR}*${PHONE_EXTENSION}$`,
  "isu",
);
const MIN_UNPREFIXED_DIGITS = 4;

/**
 * Digits, phone punctuation, and an optional extension only, so free text
 * containing a number isn't one.
 */
export function looksLikePhoneNumber(input: string): boolean {
  return PHONE_LIKE.test(input.normalize("NFKC").trim());
}

export function hasPhoneExtension(input: string): boolean {
  return NUMBER_BEFORE_EXTENSION.test(input.normalize("NFKC").trim());
}

/** Digits of the number alone, without any extension or bracketed trunk 0. */
export function phoneSearchDigits(input: string | null | undefined): string {
  return (
    input
      ?.normalize("NFKC")
      .trim()
      .replace(NUMBER_BEFORE_EXTENSION, "$1")
      .replace("(0)", "")
      .replace(/\D/g, "") ?? ""
  );
}

/**
 * The digits a stored number must contain to match a typed one. Leading zeros
 * are dropped, since E.164 drops a national trunk 0 or international 00
 * prefix, unless too few digits remain, as in the tail "0042".
 */
export function phoneSearchTerm(input: string | null | undefined): string {
  const digits = phoneSearchDigits(input);
  const unprefixed = digits.replace(/^0+/, "");
  return unprefixed.length >= MIN_UNPREFIXED_DIGITS ? unprefixed : digits;
}

/** Removes separators but preserves `+` to retain international semantics. */
export function stripPhoneNumberFormatting(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

/** National display format for inputs with a separate country selector. */
export function formatPhoneNumberNational(
  input: string,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  const parsed = R.fromThrowable(() =>
    parsePhoneNumberWithError(input.trim(), country),
  );
  if (R.isFailure(parsed) || !parsed.value.isValid()) {
    return input;
  }
  return parsed.value.formatNational();
}

/** Separator-free national form; preserves invalid input to avoid false edits. */
export function phoneNumberForEditing(
  input: string,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  const parsed = R.fromThrowable(() =>
    parsePhoneNumberWithError(input.trim(), country),
  );
  if (R.isFailure(parsed) || !parsed.value.isValid()) {
    return input;
  }
  return stripPhoneNumberFormatting(parsed.value.formatNational());
}

/** Resolved country, or `null` for invalid or non-geographic numbers. */
export function phoneNumberCountry(
  input: string | null | undefined,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): CountryCode | null {
  const trimmed = input?.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = R.fromThrowable(() =>
    parsePhoneNumberWithError(trimmed, country),
  );
  if (R.isFailure(parsed) || !parsed.value.isValid()) {
    return null;
  }
  return parsed.value.country ?? null;
}

/** A bare national number names no country without a region to read it in. */
export function internationalPhoneCountry(input: string): CountryCode | null {
  return input.trim().startsWith("+") ? phoneNumberCountry(input) : null;
}

/** Display-only national/international format; returns legacy input unchanged. */
export function formatPhoneNumberForDisplay(input: string): string {
  const parsed = R.fromThrowable(() =>
    parsePhoneNumberWithError(input.trim(), DEFAULT_PHONE_COUNTRY),
  );
  if (R.isFailure(parsed) || !parsed.value.isValid()) {
    return input;
  }
  return parsed.value.country === DEFAULT_PHONE_COUNTRY
    ? parsed.value.formatNational()
    : parsed.value.formatInternational();
}
