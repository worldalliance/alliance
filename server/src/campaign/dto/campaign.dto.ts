import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { getImageSource } from "src/images/images.service";
import { Campaign } from "../entities/campaign.entity";

export class CampaignDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ type: String, nullable: true })
  picture: string | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;

  constructor(input: Campaign) {
    this.id = input.id;
    this.name = input.name;
    this.code = input.code;
    this.picture = input.picture ? getImageSource(input.picture) : null;
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
}
