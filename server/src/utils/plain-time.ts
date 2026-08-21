import { Temporal } from "@js-temporal/polyfill";
import { registerDecorator, type ValidationOptions } from "class-validator";
import type { ValueTransformer } from "typeorm";

/**
 * `Temporal.PlainTime.from` also parses datetime forms that a Postgres `time`
 * column rejects, so parse rather than passing input straight through.
 *
 * It is stricter than Postgres about a single-digit hour. Both settings screens
 * now send `HH:MM:SS`, but the mobile ones that shipped with a free-text field
 * are still installed, so keep padding.
 */
export function toPlainTime(value: string): Temporal.PlainTime | null {
  try {
    return Temporal.PlainTime.from(value.trim().replace(/^\d:/, "0$&"));
  } catch {
    return null;
  }
}

/**
 * Parses a wall-clock time and collapses blank input to `null`, leaving
 * unparseable input intact for `@IsPlainTime` to reject.
 */
export const trimToPlainTime = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return toPlainTime(trimmed) ?? trimmed;
};

/** Accepts a wall-clock time. Pair with `@IsOptional()` for nulls. */
export function IsPlainTime(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: "isPlainTime",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return value instanceof Temporal.PlainTime;
        },
        defaultMessage(): string {
          return "$property must be a time of day, e.g. 09:30";
        },
      },
    });
  };
}

/**
 * Lets a `time` column be typed as the value it holds. Postgres renders `time`
 * as `HH:MM:SS[.ffffff]`, which `PlainTime` parses, and `PlainTime.toString()`
 * renders back into the same form.
 *
 * `24:00:00` is the one `time` value Postgres accepts and `PlainTime` rejects.
 * Nothing can write it, since every path in goes through `IsPlainTime`.
 */
export const plainTimeTransformer: ValueTransformer = {
  to: (value: Temporal.PlainTime | null | undefined) =>
    value?.toString() ?? null,
  from: (value: string | null | undefined) =>
    value ? Temporal.PlainTime.from(value) : null,
};
