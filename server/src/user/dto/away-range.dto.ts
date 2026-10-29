import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";

import { Transform } from "class-transformer";
import { IsDateString, IsDefined, IsOptional, IsString } from "class-validator";
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

export class AwayRangesInWindowQueryDto {
  @ApiProperty({ type: String, format: "date-time" })
  @IsDateString()
  from: string;

  @ApiProperty({ type: String, format: "date-time" })
  @IsDateString()
  to: string;
}

export class MemberAwayRangeDto extends UserAwayRangeDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  userName: string;

  constructor(awayRange: UserAwayRange & { user: { name: string } }) {
    super(awayRange);
    this.userId = awayRange.userId;
    this.userName = awayRange.user.name;
  }
}
