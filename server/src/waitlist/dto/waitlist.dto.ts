import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { getImageSource } from "src/images/images.service";
import { IsE164 } from "src/utils/phone";
import { trim, trimToNull } from "src/utils/transforms";
import type { WaitlistEntry } from "../entities/waitlist-entry.entity";

const IsWaitlistEmail = () =>
  applyDecorators(Transform(trim), IsEmail(), MaxLength(320));

/** At most one; neither means the visitor arrived without a referral. */
export class WaitlistReferralCodesDto {
  @ApiPropertyOptional({ description: "An organization's waitlist link code" })
  // Not `@IsOptional()`: a null would reach a `where` that TypeORM drops.
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  linkCode?: string;

  @ApiPropertyOptional({ description: "A waitlist entry's personal code" })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  referrerCode?: string;
}

export class CreateWaitlistEntryDto extends WaitlistReferralCodesDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: "Send this or `phoneNumber`" })
  @ValidateIf((_object, value) => value !== undefined)
  @IsWaitlistEmail()
  email?: string;

  @ApiPropertyOptional({ description: "E.164; send this or `email`" })
  @ValidateIf((_object, value) => value !== undefined)
  @IsE164()
  phoneNumber?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(4000)
  reason?: string | null;

  @ApiPropertyOptional({ type: Boolean, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsBoolean()
  committed?: boolean | null;
}

export class WaitlistLinkRequestDto {
  @ApiProperty()
  @IsWaitlistEmail()
  email: string;
}

export class WaitlistUnsubscribeDto {
  @ApiProperty({
    description: "The token in a waitlist email's unsubscribe link",
  })
  @IsUUID()
  token: string;
}

export class WaitlistMailConfigDto {
  @ApiProperty({ description: "Whether the waitlist can email links" })
  enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }
}

export class WaitlistEntryResultDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "The new entry's personal code; null when the contact was already on the waitlist",
  })
  shareCode: string | null;

  constructor(shareCode: string | null) {
    this.shareCode = shareCode;
  }
}

export type WaitlistOrganization = {
  name: string;
  picture: string | null;
  entryCount: number;
};

export class WaitlistOrganizationDto {
  @ApiProperty()
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "URL of the organization's logo, else its group's photo",
  })
  picture: string | null;

  @ApiProperty({ description: "Entries ever attributed to the organization" })
  entryCount: number;

  constructor(input: WaitlistOrganization) {
    this.name = input.name;
    this.picture = input.picture ? getImageSource(input.picture) : null;
    this.entryCount = input.entryCount;
  }
}

export type WaitlistReferral = {
  organization: WaitlistOrganization | null;
  inviterName: string | null;
};

export class WaitlistReferralDto {
  @ApiProperty({ type: () => WaitlistOrganizationDto, nullable: true })
  organization: WaitlistOrganizationDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Set for a personal link",
  })
  inviterName: string | null;

  constructor(input: WaitlistReferral) {
    this.organization =
      input.organization && new WaitlistOrganizationDto(input.organization);
    this.inviterName = input.inviterName;
  }
}

export class WaitlistCountDto {
  @ApiProperty({ description: "Entries not yet mobilized" })
  waiting: number;

  constructor(waiting: number) {
    this.waiting = waiting;
  }
}

export class RememberedWaitlistEntryDto {
  @ApiProperty({ description: "The entry's personal code" })
  shareCode: string;

  @ApiProperty()
  mobilized: boolean;

  constructor(input: WaitlistEntry) {
    this.shareCode = input.code;
    this.mobilized = input.mobilizedAt !== null;
  }
}

export class WaitlistBrowserDto {
  @ApiProperty({ type: () => RememberedWaitlistEntryDto, nullable: true })
  entry: RememberedWaitlistEntryDto | null;

  constructor(entry: WaitlistEntry | null) {
    this.entry = entry && new RememberedWaitlistEntryDto(entry);
  }
}
