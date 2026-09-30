import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { getImageSource } from "src/images/images.service";
import { trim, trimToNull } from "src/utils/transforms";

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

  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Required when the referral resolves to no organization",
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(4000)
  reason?: string | null;

  @ApiProperty({ type: Boolean, enum: [true] })
  @Equals(true)
  committed: true;
}

export class WaitlistLinkRequestDto extends PickType(CreateWaitlistEntryDto, [
  "email",
] as const) {}

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
      "The new entry's personal code; null when the email was already on the waitlist",
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
