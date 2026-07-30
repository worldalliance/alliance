import { isCanonicalE164, normalizePhoneNumber } from '@alliance/common/phone';
import { registerDecorator, type ValidationOptions } from 'class-validator';
import type { ValueTransformer } from 'typeorm';

/** Normalizes ORM writes but preserves invalid strings. Raw SQL bypasses this. */
export const phoneNumberTransformer: ValueTransformer = {
  to(value: unknown): unknown {
    if (typeof value !== 'string' || !value.trim()) {
      return value;
    }
    return normalizePhoneNumber(value);
  },
  from(value: unknown): unknown {
    return value;
  },
};

/** Accepts valid canonical E.164. Pair with `@IsOptional()` for nulls. */
export function IsE164(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isE164',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isCanonicalE164(value);
        },
        defaultMessage(): string {
          return '$property must be an E.164 phone number, e.g. +15551234567';
        },
      },
    });
  };
}
