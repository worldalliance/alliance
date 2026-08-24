import { isCanonicalE164, normalizePhoneNumber } from "@alliance/common/phone";
import { registerDecorator, type ValidationOptions } from "class-validator";
import type { ValueTransformer } from "typeorm";

/** Normalizes ORM writes but preserves invalid strings. Raw SQL bypasses this. */
export const phoneNumberTransformer: ValueTransformer = {
  to(value: unknown): unknown {
    if (typeof value !== "string" || !value.trim()) {
      return value;
    }
    return normalizePhoneNumber(value);
  },
  from(value: unknown): unknown {
    return value;
  },
};

/**
 * Values written by `scripts/sync_prod_to_staging.sh` in place of real member
 * numbers. `+1555…` is the current format; `15550100` is what it wrote before,
 * and survives on staging until the next sync runs.
 *
 * Keep in sync with that script — it is the only writer of these.
 */
const ANONYMIZED_PHONE_PREFIXES = ["+1555", "15550100"] as const;

/**
 * The 555 area code is unassigned in the NANP, so these can never reach a
 * handset; Twilio rejects them with error 21211. Short-circuit before the API
 * call so a staging send fails quietly instead of logging a delivery failure
 * for every member.
 */
export function isAnonymizedPhoneNumber(value: string): boolean {
  return ANONYMIZED_PHONE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** Accepts valid canonical E.164. Pair with `@IsOptional()` for nulls. */
export function IsE164(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: "isE164",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === "string" && isCanonicalE164(value);
        },
        defaultMessage(): string {
          return "$property must be an E.164 phone number, e.g. +15551234567";
        },
      },
    });
  };
}
