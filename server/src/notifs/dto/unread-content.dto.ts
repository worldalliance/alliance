import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional } from "class-validator";
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
