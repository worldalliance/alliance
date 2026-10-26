import {
  WITHDRAWAL_OPTIONS,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserActionRelationPillStatus } from "src/user/dto/user-action-relations.dto";
import { TaskAwayStatus } from "src/utils/action-user";
import {
  ViewerActionRelation,
  ViewerOptionalReason,
  type UserActionStatus,
  type UserActionWithdrawal,
} from "../user-action-status";

export class UserActionWithdrawalDto {
  @ApiProperty({ enum: WITHDRAWAL_OPTIONS, enumName: "WithdrawalOption" })
  reason: WithdrawalOption;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  constructor(input: UserActionWithdrawal) {
    this.reason = input.reason;
    this.note = input.note;
  }
}

/**
 * The viewer's full status on this action — see {@link UserActionStatus} for
 * field semantics. Replaces the flat `canParticipate` / `shouldParticipate` /
 * `userRelation` / `awayStatus` fields, which remain populated with their
 * legacy semantics until all apps migrate.
 */
export class UserActionStatusDto {
  @ApiProperty()
  assigned: boolean;

  @ApiProperty()
  optional: boolean;

  @ApiProperty({
    enum: ViewerOptionalReason,
    enumName: "ViewerOptionalReason",
    nullable: true,
  })
  optionalReason: ViewerOptionalReason | null;

  @ApiProperty()
  contractGap: boolean;

  @ApiProperty()
  canComplete: boolean;

  @ApiProperty({
    enum: ViewerActionRelation,
    enumName: "ViewerActionRelation",
  })
  relation: ViewerActionRelation;

  @ApiPropertyOptional({ type: () => UserActionWithdrawalDto })
  withdrawal?: UserActionWithdrawalDto;

  @ApiProperty()
  dismissed: boolean;

  @ApiProperty({ enum: TaskAwayStatus, enumName: "TaskAwayStatus" })
  away: TaskAwayStatus;

  @ApiProperty()
  memberActionStarted: boolean;

  @ApiProperty({ type: Date, nullable: true })
  deadlineAt: Date | null;

  @ApiProperty()
  deadlinePassed: boolean;

  @ApiProperty()
  staffPreview: boolean;

  @ApiProperty({
    enum: UserActionRelationPillStatus,
    enumName: "UserActionRelationPillStatus",
  })
  display: UserActionRelationPillStatus;

  constructor(input: UserActionStatus) {
    this.assigned = input.assigned;
    this.optional = input.optional;
    this.optionalReason = input.optionalReason;
    this.contractGap = input.contractGap;
    this.canComplete = input.canComplete;
    this.relation = input.relation;
    this.withdrawal = input.withdrawal
      ? new UserActionWithdrawalDto(input.withdrawal)
      : undefined;
    this.dismissed = input.dismissed;
    this.away = input.away;
    this.memberActionStarted = input.memberActionStarted;
    this.deadlineAt = input.deadlineAt;
    this.deadlinePassed = input.deadlinePassed;
    this.staffPreview = input.staffPreview;
    this.display = input.display;
  }
}
