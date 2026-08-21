import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";

import { Transform } from "class-transformer";
import { IsDefined, IsOptional, IsString } from "class-validator";
import { trimToNull } from "src/utils/transforms";
import { UserAwayRange } from "../entities/user-away-range.entity";

export class CreateAwayRangeDto extends PickType(UserAwayRange, ["reason"]) {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  note?: string | null;

  @ApiProperty()
  @IsDefined()
  @IsString()
  startDay: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  endDay: string;
}

export class UpdateAwayRangeDto extends PickType(UserAwayRange, ["reason"]) {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  note?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDay?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDay?: string;
}

export class UserAwayRangeDto extends PickType(UserAwayRange, [
  "id",
  "startDate",
  "endDate",
  "reason",
  "note",
  "createdAt",
]) {
  constructor(awayRange: UserAwayRange) {
    super();
    this.id = awayRange.id;
    this.startDate = awayRange.startDate;
    this.endDate = awayRange.endDate;
    this.reason = awayRange.reason;
    this.note = awayRange.note;
    this.createdAt = awayRange.createdAt;
  }
}
