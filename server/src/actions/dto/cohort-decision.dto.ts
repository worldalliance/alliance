import { ApiProperty, PickType } from "@nestjs/swagger";
import { IsBoolean, IsString, Matches } from "class-validator";
import { ActionCohortDecisionCorrection } from "../entities/action-cohort-decision-correction.entity";
import { ActionCohortDecision } from "../entities/action-cohort-decision.entity";

export class CohortDecisionCorrectionDto extends PickType(
  ActionCohortDecisionCorrection,
  [
    "previousIncluded",
    "previousReason",
    "previousResolvedAt",
    "note",
    "correctedAt",
  ],
) {
  @ApiProperty({ type: String, nullable: true })
  correctedByName: string | null;

  constructor(input: ActionCohortDecisionCorrection) {
    super();
    if (input.correctedBy === undefined) {
      throw new Error("CohortDecisionCorrectionDto requires correctedBy");
    }
    this.previousIncluded = input.previousIncluded;
    this.previousReason = input.previousReason;
    this.previousResolvedAt = input.previousResolvedAt;
    this.note = input.note;
    this.correctedByName = input.correctedBy?.name ?? null;
    this.correctedAt = input.correctedAt;
  }
}

export class CohortDecisionDto extends PickType(ActionCohortDecision, [
  "userId",
  "included",
  "reason",
  "resolvedAt",
]) {
  @ApiProperty()
  userName: string;

  @ApiProperty({ type: () => CohortDecisionCorrectionDto, isArray: true })
  corrections: CohortDecisionCorrectionDto[];

  constructor(input: ActionCohortDecision) {
    super();
    if (!input.user || !input.corrections) {
      throw new Error("CohortDecisionDto requires user and corrections");
    }
    this.userId = input.userId;
    this.userName = input.user.name;
    this.included = input.included;
    this.reason = input.reason;
    this.resolvedAt = input.resolvedAt;
    this.corrections = input.corrections.map(
      (correction) => new CohortDecisionCorrectionDto(correction),
    );
  }
}

export class CorrectCohortDecisionDto {
  @ApiProperty()
  @IsBoolean()
  included: boolean;

  @ApiProperty({ description: "Why staff are correcting the decision" })
  @IsString()
  @Matches(/\S/, { message: "note must not be blank" })
  note: string;
}
