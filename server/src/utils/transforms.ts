import type { TransformFnParams } from "class-transformer";
import { isISO8601, isRFC3339 } from "class-validator";

/**
 * `class-transformer` normalizers for request input, applied with `@Transform`.
 *
 * Non-string values pass through untouched so the validation decorators, not
 * the transform, decide what to reject.
 */

export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/**
 * Like {@link trim}, but collapses blank input to `null`. Prefer this for
 * nullable text columns so absence has a single representation.
 */
export const trimToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() || null : value;

export const trimStringArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : item))
    : value;

/**
 * Anything but a strict ISO 8601 / RFC 3339 date-time stays a string for
 * `@IsDate` to reject; `new Date` would guess a year or time zone for it.
 */
export const toDateTime = ({ value }: TransformFnParams): unknown =>
  isRFC3339(value) && isISO8601(value, { strict: true })
    ? new Date(value)
    : value;
