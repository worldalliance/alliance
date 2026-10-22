import { findWaitlistEmailPlaceholders } from "@alliance/common/waitlistEmail";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
} from "class-validator";
import { trim } from "src/utils/transforms";

const unknownPlaceholders = (value: unknown): string[] =>
  typeof value === "string"
    ? findWaitlistEmailPlaceholders([value]).unknown
    : [];

function HasOnlyKnownPlaceholders() {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: "hasOnlyKnownPlaceholders",
      target: object.constructor,
      propertyName,
      validator: {
        validate: (value: unknown) => !unknownPlaceholders(value).length,
        defaultMessage: (args) =>
          `$property has unknown placeholders: ${unknownPlaceholders(args?.value).join(", ")}`,
      },
    });
  };
}

export class WaitlistEmailContentDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @HasOnlyKnownPlaceholders()
  subject: string;

  @ApiProperty({ description: "Markdown with #{placeholder}s" })
  @IsString()
  @Matches(/\S/, { message: "$property should not be blank" })
  @MaxLength(20000)
  @HasOnlyKnownPlaceholders()
  body: string;
}
