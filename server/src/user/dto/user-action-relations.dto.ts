import { ActionActivityType } from "@alliance/common/actionActivity";
import { Temporal } from "@js-temporal/polyfill";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { ActionStatus } from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { User } from "../entities/user.entity";
import { UserAwayRangeDto } from "./away-range.dto";

export enum UserActionRelationPillStatus {
  Away = "away",
  Completed = "completed",
  MissedDeadline = "missed_deadline",
  NotRequired = "not_required",
  OptionalTask = "optional_task",
  Todo = "todo",
  WontComplete = "wont_complete",
}

export type UserActionSummary = {
  id: number;
  name: string;
  status: ActionStatus;
  weekNumber: number | null;
  allMembersParticipating: boolean;
  suiteId?: number;
  memberActionDeadline: number | null;
};

export class UserActionSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ActionStatus, enumName: "ActionStatus" })
  status: ActionStatus;

  @ApiProperty({ type: Number, nullable: true })
  weekNumber: number | null;

  @ApiProperty()
  allMembersParticipating: boolean;

  @ApiPropertyOptional()
  suiteId?: number;

  @ApiProperty({ type: Number, nullable: true })
  memberActionDeadline: number | null;

  constructor(input: UserActionSummary) {
    this.id = input.id;
    this.name = input.name;
    this.status = input.status;
    this.weekNumber = input.weekNumber;
    this.allMembersParticipating = input.allMembersParticipating;
    this.suiteId = input.suiteId;
    this.memberActionDeadline = input.memberActionDeadline;
  }
}

export class ActionSuiteSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  constructor(input: Pick<ActionSuite, "id" | "name">) {
    this.id = input.id;
    this.name = input.name;
  }
}

export type UserActionRelationDetail = {
  actionId: number;
  status: UserActionRelationPillStatus;
  latestActivityType?: ActionActivityType;
  latestActivityAt?: string;
  declineReason?: string;
  isMoral?: boolean;
  outOfTime?: boolean;
};

export class UserActionRelationDetailDto {
  @ApiProperty()
  actionId: number;

  @ApiProperty({
    enum: UserActionRelationPillStatus,
    enumName: "UserActionRelationPillStatus",
  })
  status: UserActionRelationPillStatus;

  @ApiPropertyOptional({
    enum: ActionActivityType,
    enumName: "ActionActivityType",
  })
  latestActivityType?: ActionActivityType;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  latestActivityAt?: string;

  @ApiPropertyOptional()
  declineReason?: string;

  @ApiPropertyOptional()
  isMoral?: boolean;

  @ApiPropertyOptional()
  outOfTime?: boolean;

  constructor(input: UserActionRelationDetail) {
    this.actionId = input.actionId;
    this.status = input.status;
    this.latestActivityType = input.latestActivityType;
    this.latestActivityAt = input.latestActivityAt;
    this.declineReason = input.declineReason;
    this.isMoral = input.isMoral;
    this.outOfTime = input.outOfTime;
  }
}

export type UserActionRelationsForUser = {
  userId: number;
  relations: UserActionRelationDetail[];
};

export class UserActionRelationsForUserDto {
  @ApiProperty()
  userId: number;

  @ApiProperty({ type: () => UserActionRelationDetailDto, isArray: true })
  relations: UserActionRelationDetailDto[];

  constructor(input: UserActionRelationsForUser) {
    this.userId = input.userId;
    this.relations = input.relations.map(
      (relation) => new UserActionRelationDetailDto(relation),
    );
  }
}

export type UserActionRelations = {
  actions: UserActionSummary[];
  suites: ActionSuite[];
  users: UserActionRelationsForUser[];
};

export class UserActionRelationsResponseDto {
  @ApiProperty({ type: () => UserActionSummaryDto, isArray: true })
  actions: UserActionSummaryDto[];

  @ApiProperty({ type: () => ActionSuiteSummaryDto, isArray: true })
  suites: ActionSuiteSummaryDto[];

  @ApiProperty({ type: () => UserActionRelationsForUserDto, isArray: true })
  users: UserActionRelationsForUserDto[];

  constructor(input: UserActionRelations) {
    this.actions = input.actions.map(
      (action) => new UserActionSummaryDto(action),
    );
    this.suites = input.suites.map((suite) => new ActionSuiteSummaryDto(suite));
    this.users = input.users.map(
      (user) => new UserActionRelationsForUserDto(user),
    );
  }
}

export class CommunityUserInfoDto extends UserActionRelationsResponseDto {}

export type CommunityMemberContactInfo = {
  user: User;
  timeZone?: Temporal.TimeZoneLike;
};

export class CommunityMemberContactInfoDto extends PickType(User, [
  "id",
  "timeZone",
]) {
  @ApiPropertyOptional()
  email?: string;

  @ApiProperty({ type: String, nullable: true })
  phoneNumber: string | null;

  @ApiPropertyOptional({ type: "string" })
  preferredReminderTimeUserTz?: string;

  @ApiPropertyOptional({ type: "string" })
  preferredReminderTimeLeaderTz?: string;

  @ApiProperty({ type: () => UserAwayRangeDto, isArray: true })
  awayRanges: UserAwayRangeDto[];

  constructor(input: CommunityMemberContactInfo) {
    const { user, timeZone: viewerTz } = input;
    super(user);
    this.id = user.id;
    this.email = user.shareEmailWithCommunityLead ? user.email : undefined;
    this.phoneNumber = user.sharePhoneNumberWithCommunityLead
      ? user.phoneNumber
      : null;
    this.timeZone = user.timeZone?.toString();
    this.awayRanges = (user.awayRanges ?? [])
      .slice()
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((awayRange) => new UserAwayRangeDto(awayRange));

    if (!user.preferredReminderTime) {
      return;
    }

    this.preferredReminderTimeUserTz =
      user.preferredReminderTime.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
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

    this.preferredReminderTimeLeaderTz = result.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
}
