import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import { registerDecorator, type ValidationOptions } from "class-validator";

/** Accepts an IANA identifier. Pair with `@IsOptional()` for nulls. */
export function IsTimeZoneIdentifier(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: "isTimeZoneIdentifier",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isTimeZoneIdentifier,
        defaultMessage(): string {
          return "$property must be an IANA timezone, e.g. America/New_York";
        },
      },
    });
  };
}
