import { ApiProperty } from "@nestjs/swagger";
import type { RecognitionMemberIssue } from "../action-update-recognition";
import type { RecognitionCheck } from "../action-update-recognition.service";
import {
  type ActionUpdate,
  ActionUpdateNotificationMode,
} from "../entities/action-update.entity";
import { ActionUpdateDto } from "./action.dto";

export class AdminActionUpdateDto extends ActionUpdateDto {
  @ApiProperty({
    enum: ActionUpdateNotificationMode,
    enumName: "ActionUpdateNotificationMode",
  })
  notificationMode: ActionUpdateNotificationMode;

  @ApiProperty({ type: Object, nullable: true })
  contributionFormula: unknown | null;

  @ApiProperty({ type: Object, nullable: true })
  retrospectiveContributionFormula: unknown | null;

  @ApiProperty({ type: Date, nullable: true })
  recognitionPreparedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  notificationHeldReason: string | null;

  constructor(input: ActionUpdate) {
    super(input);
    this.notificationMode = input.notificationMode;
    this.contributionFormula = input.contributionFormula;
    this.retrospectiveContributionFormula =
      input.retrospectiveContributionFormula;
    this.recognitionPreparedAt = input.recognitionPreparedAt;
    this.notificationHeldReason = input.notificationHeldReason;
  }
}

export class RecognitionMemberIssueDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  error: string;

  constructor(input: RecognitionMemberIssue) {
    this.userId = input.userId;
    this.name = input.name;
    this.error = input.error;
  }
}

export type RecognitionCheckDtoArgs = RecognitionCheck & {
  collectiveSubject: string;
};

export class RecognitionCheckDto {
  @ApiProperty({ type: String, isArray: true })
  problems: string[];

  @ApiProperty({ type: RecognitionMemberIssueDto, isArray: true })
  members: RecognitionMemberIssueDto[];

  /** The collective result's email subject, which normal-mode branch A's also ends with. */
  @ApiProperty()
  collectiveSubject: string;

  constructor(input: RecognitionCheckDtoArgs) {
    this.problems = input.problems;
    this.collectiveSubject = input.collectiveSubject;
    this.members = input.members.map(
      (member) => new RecognitionMemberIssueDto(member),
    );
  }
}
