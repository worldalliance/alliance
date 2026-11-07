import { type CohortExpression } from "@alliance/common/cohort-expression";
import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional } from "class-validator";
import { Form } from "src/tasks/entities/form.entity";
import {
  FollowUpForm,
  type ParsedFollowUpForm,
} from "../entities/follow-up-form.entity";

/** A slug is an admin label, so members get the form without it. */
export class FollowUpFormFormDto extends OmitType(Form, ["slug"]) {}

export class FollowUpFormDto extends PickType(FollowUpForm, [
  "id",
  "name",
  "startDate",
  "endDate",
  "instructions",
  "actionId",
  "formId",
]) {
  @ApiPropertyOptional({ type: () => FollowUpFormFormDto })
  @IsOptional()
  @Type(() => FollowUpFormFormDto)
  form?: FollowUpFormFormDto;

  constructor(followUpForm: FollowUpForm) {
    super();
    this.id = followUpForm.id;
    this.name = followUpForm.name;
    this.startDate = followUpForm.startDate;
    this.endDate = followUpForm.endDate;
    this.instructions = followUpForm.instructions;
    this.actionId = followUpForm.actionId;
    this.formId = followUpForm.formId;
    if (followUpForm.form) {
      const { slug: _slug, ...form } = followUpForm.form;
      this.form = form;
    }
  }
}

/**
 * A follow-up form as an admin sees it. Its cohort expression names the members
 * the form targets, so it stays off {@link FollowUpFormDto}.
 */
export class AdminFollowUpFormDto extends FollowUpFormDto {
  @ApiProperty({
    description: "Cohort expression tree defining who the form targets",
    nullable: true,
  })
  @IsOptional()
  @Type(() => Object)
  cohortExpression: CohortExpression | null;

  constructor(followUpForm: ParsedFollowUpForm) {
    super(followUpForm);
    this.cohortExpression = followUpForm.cohortExpression;
  }
}

export class CreateFollowUpFormDto extends IntersectionType(
  PickType(FollowUpForm, ["actionId", "formId"]),
  PartialType(
    PickType(FollowUpForm, [
      "startDate",
      "endDate",
      "name",
      "instructions",
      "cohortExpression",
    ]),
  ),
) {}

export class UpdateFollowUpFormDto extends PartialType(
  PickType(FollowUpForm, [
    "name",
    "startDate",
    "endDate",
    "formId",
    "instructions",
    "cohortExpression",
  ]),
) {}
