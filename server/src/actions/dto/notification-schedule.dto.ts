import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsISO8601 } from "class-validator";
import { ActionEventNotifType } from "src/notifs/entities/action-event-notif.entity";
import { ProfileDto } from "src/user/dto/user.dto";
import { ActionStatus } from "../entities/action-event.entity";

export class NotificationScheduleQueryDto {
  @ApiProperty({
    description: "ISO timestamp for the start of the window",
  })
  @IsISO8601()
  windowStart: string;

  @ApiProperty({
    description: "ISO timestamp for the end of the window",
  })
  @IsISO8601()
  windowEnd: string;
}

export class NotificationScheduleMetadataDto {
  @ApiPropertyOptional()
  currentEventId?: number;

  @ApiPropertyOptional()
  nextEventId?: number;

  @ApiPropertyOptional()
  deadlineEventId?: number;

  @ApiPropertyOptional()
  isSecondMiss?: boolean;

  @ApiPropertyOptional()
  reminderId?: number;
}

export class NotificationScheduleEntryDto {
  @ApiProperty({ enum: ActionEventNotifType, enumName: "ActionEventNotifType" })
  type: ActionEventNotifType;

  @ApiProperty({ type: String, format: "date-time" })
  @Type(() => Date)
  scheduledFor: Date;

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty({ enum: ActionStatus, enumName: "ActionStatus" })
  actionStatus: ActionStatus;

  @ApiProperty()
  eventId: number;

  @ApiProperty({ type: ProfileDto, isArray: true })
  recipients: ProfileDto[];

  @ApiPropertyOptional({
    type: NotificationScheduleMetadataDto,
  })
  metadata?: NotificationScheduleMetadataDto;

  constructor(args: {
    type: ActionEventNotifType;
    scheduledFor: Date;
    actionId: number;
    actionName: string;
    actionStatus: ActionStatus;
    eventId: number;
    recipients: ProfileDto[];
    metadata?: NotificationScheduleMetadataDto;
  }) {
    this.type = args.type;
    this.scheduledFor = args.scheduledFor;
    this.actionId = args.actionId;
    this.actionName = args.actionName;
    this.actionStatus = args.actionStatus;
    this.eventId = args.eventId;
    this.recipients = args.recipients;
    this.metadata = args.metadata;
  }
}
