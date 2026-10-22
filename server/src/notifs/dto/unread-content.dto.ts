import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
} from "class-validator";
import { toDateTime } from "src/utils/transforms";
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
