import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";
import { getImageSource } from "src/images/images.service";
import { Campaign, CampaignKind } from "../entities/campaign.entity";

export class CampaignDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ type: String, nullable: true })
  picture: string | null;

  @ApiProperty({ enum: CampaignKind, enumName: "CampaignKind" })
  kind: CampaignKind;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "An organization's accountability group",
  })
  communityId: number | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;

  constructor(input: Campaign) {
    this.id = input.id;
    this.name = input.name;
    this.code = input.code;
    this.picture = input.picture ? getImageSource(input.picture) : null;
    this.kind = input.kind;
    this.communityId = input.communityId;
    this.createdAt = input.createdAt;
    this.updatedAt = input.updatedAt;
  }
}

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: "Image key (from POST /images/uploadImage) for the avatar.",
  })
  @IsOptional()
  @IsString()
  picture?: string;

  @ApiPropertyOptional({ enum: CampaignKind, enumName: "CampaignKind" })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CampaignKind)
  kind?: CampaignKind;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  picture?: string | null;

  @ApiPropertyOptional({ enum: CampaignKind, enumName: "CampaignKind" })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CampaignKind)
  kind?: CampaignKind;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "Only an organization has a group",
  })
  @IsOptional()
  @IsInt()
  communityId?: number | null;
}
