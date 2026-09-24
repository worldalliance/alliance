import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams, Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  isISO8601,
  isRFC3339,
} from "class-validator";
import { UnreadContentType } from "../entities/unread-content.entity";
import { NotificationSourceType } from "./notification.dto";

export class ReadNotificationQueryDto {
  @ApiPropertyOptional({
    enum: NotificationSourceType,
    enumName: "NotificationSourceType",
  })
  @IsOptional()
  @IsEnum(NotificationSourceType)
  sourceType?: NotificationSourceType;
}

// Anything but a strict ISO 8601 / RFC 3339 date-time stays a string for
// @IsDate to reject; `new Date` would guess a year or time zone for it.
const toDateTime = ({ value }: TransformFnParams): unknown =>
  isRFC3339(value) && isISO8601(value, { strict: true })
    ? new Date(value)
    : value;

export class ReadAllNotificationsQueryDto {
  // eslint-disable-next-line @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator -- toDateTime converts; @Type(() => Date) would parse loosely
  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description:
      "The list's x-notifs-loaded-at header. Marks only rows due and created at or before this time, to the millisecond. The server caps the due bound at now.",
  })
  @IsOptional()
  @Transform(toDateTime)
  @IsDate()
  loadedAt?: Date;
}

export class MarkUnreadContentReadDto {
  @ApiProperty({
    enum: UnreadContentType,
    enumName: "UnreadContentType",
  })
  @IsEnum(UnreadContentType)
  contentType: UnreadContentType;

  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  contentIds: number[];
}
