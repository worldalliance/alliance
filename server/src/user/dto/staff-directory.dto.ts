import { publicDisplayName } from "@alliance/common/displayName";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { getImageSource } from "src/images/images.service";
import { trimToNull } from "src/utils/transforms";
import { User } from "../entities/user.entity";

export class StaffDirectoryEntryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ type: String, nullable: true })
  profilePicture: string | null;

  @ApiProperty({ type: String, nullable: true })
  staffTitle: string | null;

  @ApiProperty({ type: String, nullable: true })
  staffLink: string | null;

  @ApiProperty()
  staffDisplayOrder: number;

  constructor(
    user: Pick<
      User,
      | "id"
      | "name"
      | "anonymous"
      | "profilePicture"
      | "staffTitle"
      | "staffLink"
      | "staffDisplayOrder"
    >,
  ) {
    this.id = user.id;
    this.displayName = publicDisplayName(user);
    this.profilePicture = user.profilePicture
      ? getImageSource(user.profilePicture)
      : null;
    this.staffTitle = user.staffTitle;
    this.staffLink = user.staffLink;
    this.staffDisplayOrder = user.staffDisplayOrder;
  }
}

export class StaffDirectoryItemUpdateDto {
  @ApiProperty()
  @IsInt()
  id: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  staffTitle?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  staffLink?: string | null;

  @ApiProperty()
  @IsInt()
  staffDisplayOrder: number;
}

export class UpdateStaffDirectoryDto {
  @ApiProperty({ type: () => StaffDirectoryItemUpdateDto, isArray: true })
  @Type(() => StaffDirectoryItemUpdateDto)
  @IsArray()
  @ValidateNested({ each: true })
  items: StaffDirectoryItemUpdateDto[];
}
