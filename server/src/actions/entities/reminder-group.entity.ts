import { Temporal } from "@js-temporal/polyfill";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsDefined, IsOptional } from "class-validator";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { Tag } from "src/user/entities/tag.entity";
import { DEFAULT_TIME_ZONE, User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ActionEvent } from "./action-event.entity";
import { ActionSuite } from "./action-suite.entity";

export enum ReminderGroupTimingMode {
  Absolute = "absolute",
  FromDeadline = "from_deadline",
  WithinRange = "within_range",
  WithinRelativeRange = "within_relative_range",
  EventLaunch = "event_launch",
}

export enum ReminderCohortType {
  AllUncompleted = "all_uncompleted",
  GroupLeadsWithUncompleted = "group_leads_with_uncompleted",
  Tag = "tag",
  Custom = "custom",
}

/**
 * Whether notifs from this cohort personally notify recipients about their own
 * task on the event, as opposed to nudging them about *other* users (group
 * leads). Only personal notifs count as "this user was notified about this
 * event" for `excludePreviouslyNotified`.
 */
export function cohortNotifiesRecipientPersonally(
  cohortType: ReminderCohortType,
): boolean {
  switch (cohortType) {
    case ReminderCohortType.AllUncompleted:
    case ReminderCohortType.Tag:
    case ReminderCohortType.Custom:
      return true;
    case ReminderCohortType.GroupLeadsWithUncompleted:
      return false;
    default:
      throw new Error(`unknown cohort type: ${cohortType satisfies never}`);
  }
}

@Entity()
@Check(
  `("timingMode" = 'absolute' AND "sendAtAbsolute" IS NOT NULL)
     OR ("timingMode" = 'from_deadline' AND "sendAtSecondsFromDeadline" IS NOT NULL)
     OR ("timingMode" = 'within_range' AND "send_range_start" IS NOT NULL AND "send_range_end" IS NOT NULL)
     OR ("timingMode" = 'within_relative_range' AND "relative_range_start_seconds_from_deadline" IS NOT NULL AND "relative_range_end_seconds_from_deadline" IS NOT NULL)
     OR ("timingMode" = 'event_launch' AND "memberActionEventId" IS NOT NULL)`,
)
@Check(
  `send_range_start IS NULL OR send_range_end IS NULL OR send_range_start <= send_range_end`,
)
@Check(
  `relative_range_start_seconds_from_deadline IS NULL OR relative_range_end_seconds_from_deadline IS NULL OR relative_range_start_seconds_from_deadline >= relative_range_end_seconds_from_deadline`,
)
export class ReminderGroup {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  name: string;

  @ApiProperty({
    enum: ReminderGroupTimingMode,
    enumName: "ReminderGroupTimingMode",
  })
  @Column({
    type: "enum",
    enum: ReminderGroupTimingMode,
    default: ReminderGroupTimingMode.WithinRange,
  })
  @IsDefined()
  timingMode: ReminderGroupTimingMode;

  @ManyToOne(() => ActionSuite, (suite) => suite.reminderGroups, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @ApiPropertyOptional({ type: () => ActionSuite })
  @Type(() => ActionSuite)
  @IsOptional()
  actionSuite?: Relation<ActionSuite>;

  @ManyToOne(() => ActionEvent, { nullable: false, onDelete: "CASCADE" })
  @ApiProperty({ type: () => ActionEvent })
  @Type(() => ActionEvent)
  @IsDefined()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  memberActionEvent: Relation<ActionEvent>;

  @ApiProperty({
    enum: ReminderCohortType,
    enumName: "ReminderCohortType",
  })
  @Column({ type: "enum", enum: ReminderCohortType, nullable: true })
  @Allow()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  cohortType: ReminderCohortType;

  @ManyToOne(() => Tag)
  @ApiPropertyOptional({ type: () => Tag })
  @Type(() => Tag)
  @IsOptional()
  userTag?: Relation<Tag>;

  // for custom cohort
  @ManyToMany(() => User)
  @JoinTable({ name: "reminder_group_users" })
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @Type(() => User)
  @IsOptional()
  users?: Relation<User>[];

  @ApiProperty({ type: String })
  @Column({ type: "text" })
  @IsDefined()
  emailMessage: string;

  @ApiProperty({ type: String })
  @Column({ type: "text" })
  @IsDefined()
  emailSubject: string;

  @ApiProperty({ type: String })
  @Column({ type: "text" })
  @IsDefined()
  textMessage: string;

  @ApiProperty({ type: String })
  @Column({ type: "text", default: "" })
  @IsDefined()
  pushMessage: string;

  @ApiProperty({ type: () => ActionEventNotif, isArray: true })
  @OneToMany(
    () => ActionEventNotif,
    (notification) => notification.reminderGroup,
  )
  @Allow()
  @Type(() => ActionEventNotif)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  notifications: Relation<ActionEventNotif>[];

  @ApiPropertyOptional({ type: Date })
  @Column({ type: "timestamptz", nullable: true })
  @Type(() => Date)
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  send_range_start?: Date;

  @ApiPropertyOptional({ type: Date })
  @Column({ type: "timestamptz", nullable: true })
  @Type(() => Date)
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  send_range_end?: Date;

  @ApiPropertyOptional({ type: Date })
  @Column({ type: "timestamptz", nullable: true })
  @Type(() => Date)
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  sendAtAbsolute?: Date;

  @ApiPropertyOptional({ type: Number })
  @Column({ type: "integer", nullable: true })
  @IsOptional()
  @Type(() => Number)
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  sendAtSecondsFromDeadline?: number;

  @ApiPropertyOptional({ type: Number })
  @Column({ type: "integer", nullable: true })
  @IsOptional()
  @Type(() => Number)
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  relative_range_start_seconds_from_deadline?: number;

  @ApiPropertyOptional({ type: Number })
  @Column({ type: "integer", nullable: true })
  @IsOptional()
  @Type(() => Number)
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  relative_range_end_seconds_from_deadline?: number;

  @ManyToOne(() => ActionEvent, { nullable: true, onDelete: "SET NULL" })
  @ApiPropertyOptional({ type: () => ActionEvent })
  @Type(() => ActionEvent)
  @IsOptional()
  deadlineEvent?: Relation<ActionEvent>;

  /**
   * Overrides `deadlineEvent` as the reference date for the FromDeadline and
   * WithinRelativeRange timing modes — e.g. to send at a *dependency* action's
   * deadline, catching users who joined this action's cohort late via a form
   * response. Read only by send-time computation; `deadlineEvent` keeps its
   * assignment-window and message-keyword semantics.
   */
  @ManyToOne(() => ActionEvent, { nullable: true, onDelete: "SET NULL" })
  @ApiPropertyOptional({ type: () => ActionEvent })
  @Type(() => ActionEvent)
  @IsOptional()
  timingAnchorEvent?: Relation<ActionEvent> | null;

  @ApiProperty()
  @Column({ type: "boolean", default: true })
  @IsDefined()
  @Allow()
  useSuiteTaskCount: boolean;

  @ApiProperty()
  @Column({ type: "boolean", default: false })
  @IsDefined()
  @Allow()
  allSent: boolean;

  @ApiProperty()
  @Column({ type: "boolean", default: false })
  @IsDefined()
  @Allow()
  excludeOptionalActions: boolean;

  /**
   * Only tell users about tasks they haven't already been notified about by
   * a sent notification from any reminder group on the same member-action
   * event: the message's task list/count is narrowed to the not-yet-notified
   * tasks, and users with no such tasks are skipped entirely.
   */
  @ApiProperty()
  @Column({ type: "boolean", default: false })
  @IsDefined()
  @Allow()
  excludePreviouslyNotified: boolean;
}

export function firstOccurrenceInRange(
  tz: Temporal.TimeZoneLike,
  timeOfDay: Temporal.PlainTime,
  rangeStart: Temporal.Instant,
  rangeEnd: Temporal.Instant,
): Date | null {
  if (Temporal.Instant.compare(rangeStart, rangeEnd) > 0) {
    throw new RangeError("rangeStart must be <= rangeEnd");
  }

  let date = rangeStart.toZonedDateTimeISO(tz).toPlainDate();

  const max_n = 100;
  for (let n = 0; n < max_n; n++) {
    const local = date.toPlainDateTime(timeOfDay);

    const zdt = local.toZonedDateTime(tz);
    const candidate = zdt.toInstant();

    if (Temporal.Instant.compare(candidate, rangeEnd) > 0) return null;
    if (Temporal.Instant.compare(candidate, rangeStart) >= 0)
      return new Date(candidate.epochMilliseconds);

    date = date.add({ days: 1 });
  }
  return null;
}

function offsetTimeFromSeconds(time: Date, seconds: number): Date {
  return new Date(time.getTime() - seconds * 1000);
}

export function getGroupSendTimeForUser(
  user: User,
  group: ReminderGroup,
): Date | null {
  const referenceEvent = group.timingAnchorEvent ?? group.deadlineEvent;
  switch (group.timingMode) {
    case ReminderGroupTimingMode.Absolute:
      return group.sendAtAbsolute ?? new Date();
    case ReminderGroupTimingMode.FromDeadline:
      if (!referenceEvent) {
        throw new Error(
          "Deadline or anchor event is required for from_deadline timing mode",
        );
      }
      return offsetTimeFromSeconds(
        referenceEvent.date,
        group.sendAtSecondsFromDeadline!,
      );
    case ReminderGroupTimingMode.WithinRange:
      return firstOccurrenceInRange(
        user.timeZone ?? DEFAULT_TIME_ZONE,
        user.preferredReminderTime ?? Temporal.PlainTime.from("19:00:00"),
        Temporal.Instant.fromEpochMilliseconds(
          group.send_range_start!.getTime(),
        ),
        Temporal.Instant.fromEpochMilliseconds(group.send_range_end!.getTime()),
      );
    case ReminderGroupTimingMode.WithinRelativeRange:
      if (!referenceEvent) {
        throw new Error(
          "Deadline or anchor event is required for within_relative_range timing mode",
        );
      }
      const start = offsetTimeFromSeconds(
        referenceEvent.date,
        group.relative_range_start_seconds_from_deadline!,
      );
      const end = offsetTimeFromSeconds(
        referenceEvent.date,
        group.relative_range_end_seconds_from_deadline!,
      );
      return firstOccurrenceInRange(
        user.timeZone ?? DEFAULT_TIME_ZONE,
        user.preferredReminderTime ?? Temporal.PlainTime.from("19:00:00"),
        Temporal.Instant.fromEpochMilliseconds(start.getTime()),
        Temporal.Instant.fromEpochMilliseconds(end.getTime()),
      );
    case ReminderGroupTimingMode.EventLaunch:
      return group.memberActionEvent.date;
    default:
      throw new Error(
        `Invalid timing mode: ${group.timingMode satisfies never}`,
      );
  }
}
