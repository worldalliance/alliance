import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { isMissedSuiteReminderGroup } from "src/notifs/missed-suite-notice";
import { ActionEvent } from "../entities/action-event.entity";
import {
  loadedReminderGroupMemberActionEvent,
  ReminderCohortType,
  ReminderGroup,
} from "../entities/reminder-group.entity";

export class CreateReminderGroupDto extends IntersectionType(
  PickType(ReminderGroup, [
    "name",
    "emailMessage",
    "cohortType",
    "timingMode",
    "emailSubject",
    "textMessage",
    "pushMessage",
    "useSuiteTaskCount",
    "excludeOptionalActions",
    "excludePreviouslyNotified",
  ]),
  PartialType(
    PickType(ReminderGroup, [
      "sendAtAbsolute",
      "sendAtSecondsFromDeadline",
      "send_range_start",
      "send_range_end",
      "relative_range_start_seconds_from_deadline",
      "relative_range_end_seconds_from_deadline",
    ]),
  ),
) {
  @ApiPropertyOptional({ type: Number, isArray: true })
  @IsOptional()
  userIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  userTagId?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  suiteId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  timingAnchorEventId?: number;
}

export class ReminderPreviewContextDto {
  @ApiProperty({ type: Number })
  @IsDefined()
  @IsNumber()
  taskCount: number;

  @ApiPropertyOptional({ enum: ReminderCohortType })
  @IsOptional()
  @IsEnum(ReminderCohortType)
  cohortType?: ReminderCohortType;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  uncompletedMembersInGroupCount?: number;
}

export class PreviewEmailHtmlDto extends IntersectionType(
  PickType(CreateReminderGroupDto, ["emailMessage", "emailSubject"]),
  ReminderPreviewContextDto,
) {}

export class PreviewTextDto extends IntersectionType(
  PickType(CreateReminderGroupDto, ["textMessage"]),
  ReminderPreviewContextDto,
) {}

export class PreviewTextMessageResponseDto {
  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  text: string;

  constructor(text: string) {
    this.text = text;
  }
}

export interface PreviewEmailHtmlResponse {
  subject: string;
  html: string;
}

export class PreviewEmailHtmlResponseDto implements PreviewEmailHtmlResponse {
  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  subject: string;

  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  html: string;

  constructor(data: PreviewEmailHtmlResponse) {
    this.subject = data.subject;
    this.html = data.html;
  }
}

export class ReminderGroupDto extends PickType(ReminderGroup, [
  "id",
  "name",
  "timingMode",
  "actionSuite",
  "cohortType",
  "userTag",
  "users",
  "emailMessage",
  "emailSubject",
  "textMessage",
  "pushMessage",
  "send_range_start",
  "send_range_end",
  "sendAtAbsolute",
  "sendAtSecondsFromDeadline",
  "relative_range_start_seconds_from_deadline",
  "relative_range_end_seconds_from_deadline",
  "deadlineEvent",
  "timingAnchorEvent",
  "useSuiteTaskCount",
  "allSent",
  "excludeOptionalActions",
  "excludePreviouslyNotified",
]) {
  @ApiProperty({ type: () => ActionEvent })
  @Type(() => ActionEvent)
  memberActionEvent: ActionEvent;

  @ApiProperty({
    description:
      "Whether the group's email uses a missed-suite keyword, so dispatch sends it as a missed-suite notice",
  })
  isMissedSuite: boolean;

  constructor(group: ReminderGroup) {
    super();
    this.id = group.id;
    this.name = group.name;
    this.timingMode = group.timingMode;
    this.actionSuite = group.actionSuite;
    this.memberActionEvent = loadedReminderGroupMemberActionEvent(group);
    this.cohortType = group.cohortType;
    this.userTag = group.userTag;
    this.users = group.users;
    this.emailMessage = group.emailMessage;
    this.emailSubject = group.emailSubject;
    this.textMessage = group.textMessage;
    this.pushMessage = group.pushMessage;
    this.send_range_start = group.send_range_start;
    this.send_range_end = group.send_range_end;
    this.sendAtAbsolute = group.sendAtAbsolute;
    this.sendAtSecondsFromDeadline = group.sendAtSecondsFromDeadline;
    this.relative_range_start_seconds_from_deadline =
      group.relative_range_start_seconds_from_deadline;
    this.relative_range_end_seconds_from_deadline =
      group.relative_range_end_seconds_from_deadline;
    this.deadlineEvent = group.deadlineEvent;
    this.timingAnchorEvent = group.timingAnchorEvent;
    this.useSuiteTaskCount = group.useSuiteTaskCount;
    this.allSent = group.allSent;
    this.excludeOptionalActions = group.excludeOptionalActions;
    this.excludePreviouslyNotified = group.excludePreviouslyNotified;
    this.isMissedSuite = isMissedSuiteReminderGroup(group);
  }
}

/**
 * A dependency action's deadline event, offered as a reminder-group timing
 * anchor (`ReminderGroup.timingAnchorEvent`). Dependencies are derived from
 * the action's cohort expression (form-response and completed/missed
 * action conditions).
 */
export type ReminderAnchorCandidate = {
  actionId: number;
  actionName: string;
  deadlineEventId: number;
  deadlineEventDate: Date;
};

export class ReminderAnchorCandidateDto {
  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty()
  deadlineEventId: number;

  @ApiProperty({ type: Date })
  deadlineEventDate: Date;

  constructor(input: ReminderAnchorCandidate) {
    this.actionId = input.actionId;
    this.actionName = input.actionName;
    this.deadlineEventId = input.deadlineEventId;
    this.deadlineEventDate = input.deadlineEventDate;
  }
}
