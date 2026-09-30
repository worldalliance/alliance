import { WaitlistEmailPlaceholder } from "@alliance/common/waitlistEmail";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
} from "class-validator";
import type { WaitlistEntry } from "../entities/waitlist-entry.entity";
import { WaitlistEmailContentDto } from "./waitlist-email-content.dto";

export class WaitlistEmailAudienceDto extends WaitlistEmailContentDto {
  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  entryIds: number[];

  @ApiProperty({
    description: "Also email entries whose invite an account claimed",
  })
  @IsBoolean()
  includeClaimed: boolean;
}

export class PreviewWaitlistEmailDto extends WaitlistEmailAudienceDto {
  @ApiPropertyOptional({ description: "The recipient to render" })
  @IsOptional()
  @IsInt()
  sampleEntryId?: number;
}

export type WaitlistEmailSample = {
  entry: WaitlistEntry;
  subject: string | null;
  html: string | null;
  missing: WaitlistEmailPlaceholder[];
};

export class WaitlistEmailSampleDto {
  @ApiProperty()
  entryId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: String, nullable: true })
  subject: string | null;

  @ApiProperty({ type: String, nullable: true })
  html: string | null;

  @ApiProperty({
    enum: WaitlistEmailPlaceholder,
    enumName: "WaitlistEmailPlaceholder",
    isArray: true,
  })
  missing: WaitlistEmailPlaceholder[];

  constructor(input: WaitlistEmailSample) {
    this.entryId = input.entry.id;
    this.name = input.entry.name;
    this.email = input.entry.email;
    this.subject = input.subject;
    this.html = input.html;
    this.missing = input.missing;
  }
}

export type WaitlistEmailPreview = {
  selected: number;
  unsubscribed: number;
  claimed: number;
  recipientIds: number[];
  waiting: number;
  withoutOrganization: number;
  withoutGroup: number;
  sample: WaitlistEmailSample | null;
};

export class WaitlistEmailPreviewDto {
  @ApiProperty({ description: "Selected entries that exist" })
  selected: number;

  @ApiProperty({ description: "Selected entries skipped as unsubscribed" })
  unsubscribed: number;

  @ApiProperty({
    description:
      "Subscribed selected entries whose invite an account claimed, skipped unless included",
  })
  claimed: number;

  @ApiProperty({ type: Number, isArray: true })
  recipientIds: number[];

  @ApiProperty({ description: "Recipients not yet mobilized" })
  waiting: number;

  @ApiProperty({ description: "Recipients with no organization" })
  withoutOrganization: number;

  @ApiProperty({
    description: "Recipients whose organization has no group",
  })
  withoutGroup: number;

  @ApiProperty({ type: () => WaitlistEmailSampleDto, nullable: true })
  sample: WaitlistEmailSampleDto | null;

  constructor(input: WaitlistEmailPreview) {
    this.selected = input.selected;
    this.unsubscribed = input.unsubscribed;
    this.claimed = input.claimed;
    this.recipientIds = input.recipientIds;
    this.waiting = input.waiting;
    this.withoutOrganization = input.withoutOrganization;
    this.withoutGroup = input.withoutGroup;
    this.sample = input.sample && new WaitlistEmailSampleDto(input.sample);
  }
}
