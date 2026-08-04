import { Temporal } from '@js-temporal/polyfill';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * `Temporal.PlainTime.from` also parses datetime forms that a Postgres `time`
 * column rejects, so canonicalize rather than passing input straight through.
 *
 * It is stricter than Postgres about a single-digit hour, which the free-text
 * mobile settings input accepts today, so pad before parsing.
 */
function toPlainTimeString(value: string): string | null {
  try {
    return Temporal.PlainTime.from(value.replace(/^\d:/, '0$&')).toString();
  } catch {
    return null;
  }
}

/**
 * Normalizes a wall-clock time to `HH:MM:SS` and blank input to `null`, leaving
 * unparseable input intact for `@IsPlainTime` to reject.
 */
export const trimToPlainTime = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return toPlainTimeString(trimmed) ?? trimmed;
};

/** Accepts a canonical wall-clock time. Pair with `@IsOptional()` for nulls. */
export function IsPlainTime(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isPlainTime',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' && toPlainTimeString(value) === value
          );
        },
        defaultMessage(): string {
          return '$property must be a time of day, e.g. 09:30';
        },
      },
    });
  };
}
