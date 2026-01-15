import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { ActionStatus } from 'src/actions/entities/action-event.entity';
import { ActionActivityType } from 'src/actions/entities/action-activity.entity';
import { User } from '../entities/user.entity';
import { Temporal } from '@js-temporal/polyfill';
import { UserAwayRangeDto } from './away-range.dto';

export enum UserActionRelationPillStatus {
  Away = 'away',
  Completed = 'completed',
  MissedDeadline = 'missed_deadline',
  NotRequired = 'not_required',
  OptionalTask = 'optional_task',
  Todo = 'todo',
  WontComplete = 'wont_complete',
}

export class UserActionSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ActionStatus, enumName: 'ActionStatus' })
  status: ActionStatus;

  @ApiProperty({ type: Number, nullable: true })
  weekNumber: number | null;

  @ApiProperty()
  allMembersParticipating: boolean;

  @ApiPropertyOptional()
  suiteId?: number;
}

export class ActionSuiteSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

export class UserActionRelationDetailDto {
  @ApiProperty()
  actionId: number;

  @ApiProperty({
    enum: UserActionRelationPillStatus,
    enumName: 'UserActionRelationPillStatus',
  })
  status: UserActionRelationPillStatus;

  @ApiPropertyOptional({
    enum: ActionActivityType,
    enumName: 'ActionActivityType',
  })
  latestActivityType?: ActionActivityType;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  latestActivityAt?: string;

  @ApiPropertyOptional()
  declineReason?: string;

  @ApiPropertyOptional()
  isMoral?: boolean;

  @ApiPropertyOptional()
  outOfTime?: boolean;
}

export class UserActionRelationsForUserDto {
  @ApiProperty()
  userId: number;

  @ApiProperty({ type: () => UserActionRelationDetailDto, isArray: true })
  relations: UserActionRelationDetailDto[];
}

export class UserActionRelationsResponseDto {
  @ApiProperty({ type: () => UserActionSummaryDto, isArray: true })
  actions: UserActionSummaryDto[];

  @ApiProperty({ type: () => ActionSuiteSummaryDto, isArray: true })
  suites: ActionSuiteSummaryDto[];

  @ApiProperty({ type: () => UserActionRelationsForUserDto, isArray: true })
  users: UserActionRelationsForUserDto[];
}

export class CommunityUserInfoDto extends UserActionRelationsResponseDto {}

export class CommunityMemberContactInfoDto extends PickType(User, [
  'id',
  'timeZone',
  'preferredActionReminderChannel',
]) {
  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ type: 'string' })
  preferredReminderTimeUserTz?: string;

  @ApiPropertyOptional({ type: 'string' })
  preferredReminderTimeLeaderTz?: string;

  @ApiProperty({ type: () => UserAwayRangeDto, isArray: true })
  awayRanges: UserAwayRangeDto[];

  constructor(
    user: User,
    viewerTz?: Temporal.TimeZoneLike,
    awayRanges: UserAwayRangeDto[] = [],
  ) {
    super(user);
    this.id = user.id;
    this.email = user.shareEmailWithCommunityLead ? user.email : undefined;
    this.phoneNumber = user.sharePhoneNumberWithCommunityLead
      ? user.phoneNumber
      : undefined;
    this.timeZone = user.timeZone?.toString();
    this.preferredActionReminderChannel = user.preferredActionReminderChannel;
    this.awayRanges = awayRanges;

    if (!user.preferredReminderTime) {
      return;
    }

    this.preferredReminderTimeUserTz = Temporal.PlainTime.from(
      user.preferredReminderTime,
    ).toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (!user.timeZone || !viewerTz) {
      return;
    }

    const today = Temporal.Now.plainDateISO(user.timeZone);
    const dateTime = today.toPlainDateTime(user.preferredReminderTime);
    const zoned = dateTime.toZonedDateTime(user.timeZone);
    const inTarget = zoned.withTimeZone(viewerTz);
    const result = inTarget.toPlainTime();

    this.preferredReminderTimeLeaderTz = result.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
