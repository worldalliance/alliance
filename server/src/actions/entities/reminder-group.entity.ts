import { Temporal } from '@js-temporal/polyfill';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsOptional } from 'class-validator';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';
import { Ty } from 'src/tasks/entities/type';
import { Tag } from 'src/user/entities/tag.entity';
import { User } from 'src/user/entities/user.entity';
import {
  Check,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActionEvent } from './action-event.entity';
import { ActionSuite } from './action-suite.entity';

export enum ReminderGroupTimingMode {
  Absolute = 'absolute',
  FromDeadline = 'from_deadline',
  WithinRange = 'within_range',
  WithinRelativeRange = 'within_relative_range',
  EventLaunch = 'event_launch',
}

export enum ReminderCohortType {
  AllUncompleted = 'all_uncompleted',
  Tag = 'tag',
  Custom = 'custom',
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
    enumName: 'ReminderGroupTimingMode',
  })
  @Column({
    type: 'enum',
    enum: ReminderGroupTimingMode,
    default: ReminderGroupTimingMode.WithinRange,
  })
  @IsDefined()
  timingMode: ReminderGroupTimingMode;

  @ManyToOne(() => ActionSuite, (suite) => suite.reminderGroups, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @ApiPropertyOptional({ type: () => ActionSuite })
  @Type(() => ActionSuite)
  @IsOptional()
  actionSuite?: Ty<ActionSuite>;

  @ManyToOne(() => ActionEvent, { onDelete: 'CASCADE' })
  @ApiProperty({ type: () => ActionEvent })
  @Type(() => ActionEvent)
  @IsDefined()
  memberActionEvent: Ty<ActionEvent>;

  @ApiProperty({
    enum: ReminderCohortType,
    enumName: 'ReminderCohortType',
  })
  @Column({ type: 'enum', enum: ReminderCohortType, nullable: true })
  @Allow()
  cohortType: ReminderCohortType;

  @ManyToOne(() => Tag)
  @ApiPropertyOptional({ type: () => Tag })
  @Type(() => Tag)
  @IsOptional()
  userTag?: Ty<Tag>;

  // for custom cohort
  @ManyToMany(() => User)
  @JoinTable({ name: 'reminder_group_users' })
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @Type(() => User)
  @IsOptional()
  users?: User[];

  @ApiProperty({ type: String })
  @Column({ type: 'text' })
  @IsDefined()
  emailMessage: string;

  @ApiProperty({ type: String })
  @Column({ type: 'text' })
  @IsDefined()
  emailSubject: string;

  @ApiProperty({ type: String })
  @Column({ type: 'text' })
  @IsDefined()
  textMessage: string;

  @ApiProperty({ type: String })
  @Column({ type: 'text', default: '' })
  @IsDefined()
  pushMessage: string;

  @ApiProperty({ type: () => ActionEventNotif, isArray: true })
  @OneToMany(
    () => ActionEventNotif,
    (notification) => notification.reminderGroup,
  )
  @Allow()
  @Type(() => ActionEventNotif)
  notifications: Ty<ActionEventNotif>[];

  @ApiPropertyOptional({ type: Date })
  @Column({ type: 'timestamptz', nullable: true })
  @Type(() => Date)
  @IsOptional()
  send_range_start?: Date;

  @ApiPropertyOptional({ type: Date })
  @Column({ type: 'timestamptz', nullable: true })
  @Type(() => Date)
  @IsOptional()
  send_range_end?: Date;

  @ApiPropertyOptional({ type: Date })
  @Column({ type: 'timestamptz', nullable: true })
  @Type(() => Date)
  @IsOptional()
  sendAtAbsolute?: Date;

  @ApiPropertyOptional({ type: Number })
  @Column({ type: 'integer', nullable: true })
  @IsOptional()
  @Type(() => Number)
  sendAtSecondsFromDeadline?: number;

  @ApiPropertyOptional({ type: Number })
  @Column({ type: 'integer', nullable: true })
  @IsOptional()
  @Type(() => Number)
  relative_range_start_seconds_from_deadline?: number;

  @ApiPropertyOptional({ type: Number })
  @Column({ type: 'integer', nullable: true })
  @IsOptional()
  @Type(() => Number)
  relative_range_end_seconds_from_deadline?: number;

  @ManyToOne(() => ActionEvent, { nullable: true, onDelete: 'SET NULL' })
  @ApiPropertyOptional({ type: () => ActionEvent })
  @Type(() => ActionEvent)
  @IsOptional()
  deadlineEvent?: Ty<ActionEvent>;

  @ApiProperty({ type: Boolean })
  @Column({ type: 'boolean', default: true })
  @IsDefined()
  @Allow()
  useSuiteTaskCount: boolean;

  @ApiProperty({ type: Boolean })
  @Column({ type: 'boolean', default: false })
  @IsDefined()
  @Allow()
  allSent: boolean;
}

export function firstOccurrenceInRange(
  tz: Temporal.TimeZoneLike,
  timeOfDay: Temporal.PlainTime,
  rangeStart: Temporal.Instant,
  rangeEnd: Temporal.Instant,
): Date | null {
  if (Temporal.Instant.compare(rangeStart, rangeEnd) > 0) {
    throw new RangeError('rangeStart must be <= rangeEnd');
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
  const deadlineEvent = group.deadlineEvent;
  switch (group.timingMode) {
    case ReminderGroupTimingMode.Absolute:
      return group.sendAtAbsolute ?? new Date();
    case ReminderGroupTimingMode.FromDeadline:
      if (!deadlineEvent) {
        throw new Error(
          'Deadline event is required for from_deadline timing mode',
        );
      }
      return offsetTimeFromSeconds(
        deadlineEvent.date,
        group.sendAtSecondsFromDeadline!,
      );
    case ReminderGroupTimingMode.WithinRange:
      return firstOccurrenceInRange(
        user.timeZone ?? 'America/Los_Angeles',
        user.preferredReminderTime ?? Temporal.PlainTime.from('19:00:00'),
        Temporal.Instant.fromEpochMilliseconds(
          group.send_range_start!.getTime(),
        ),
        Temporal.Instant.fromEpochMilliseconds(group.send_range_end!.getTime()),
      );
    case ReminderGroupTimingMode.WithinRelativeRange:
      if (!deadlineEvent) {
        throw new Error(
          'Deadline event is required for within_relative_range timing mode',
        );
      }
      const start = offsetTimeFromSeconds(
        deadlineEvent.date,
        group.relative_range_start_seconds_from_deadline!,
      );
      const end = offsetTimeFromSeconds(
        deadlineEvent.date,
        group.relative_range_end_seconds_from_deadline!,
      );
      return firstOccurrenceInRange(
        user.timeZone ?? 'America/Los_Angeles',
        user.preferredReminderTime ?? Temporal.PlainTime.from('19:00:00'),
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
