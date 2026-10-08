import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { trim } from "src/utils/transforms";
import type { WaitlistLink } from "../entities/waitlist-link.entity";

export type AdminWaitlistLink = { link: WaitlistLink; entryCount: number };

export class AdminWaitlistLinkDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  organizationId: number;

  @ApiProperty()
  channel: string;

  @ApiProperty()
  showReferralMessage: boolean;

  @ApiProperty({ type: Date, nullable: true })
  publishedAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ description: "Entries whose referral chain began here" })
  entryCount: number;

  constructor(input: AdminWaitlistLink) {
    this.id = input.link.id;
    this.code = input.link.code;
    this.organizationId = input.link.organizationId;
    this.channel = input.link.channel;
    this.showReferralMessage = input.link.showReferralMessage;
    this.publishedAt = input.link.publishedAt;
    this.archivedAt = input.link.archivedAt;
    this.createdAt = input.link.createdAt;
    this.entryCount = input.entryCount;
  }
}

export class CreateWaitlistLinkDto {
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  showReferralMessage?: boolean;

  @ApiProperty()
  @IsInt()
  organizationId: number;

  @ApiProperty({ description: "Where the link is shared, e.g. Newsletter" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  channel: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;
}

export class UpdateWaitlistLinkDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  showReferralMessage?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  channel?: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @ApiPropertyOptional({
    description: "Archiving stops new entries through the link",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  archived?: boolean;
}
