import {
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional } from "class-validator";
import { Form } from "src/tasks/entities/form.entity";
import { FollowUpForm } from "../entities/follow-up-form.entity";

export class FollowUpFormDto extends PickType(FollowUpForm, [
  "id",
  "name",
  "startDate",
  "endDate",
  "instructions",
  "cohortExpression",
  "actionId",
  "formId",
]) {
  @ApiPropertyOptional({ type: () => Form })
  @IsOptional()
  @Type(() => Form)
  form?: Form;

  constructor(followUpForm: FollowUpForm) {
    super();
    this.id = followUpForm.id;
    this.name = followUpForm.name;
    this.startDate = followUpForm.startDate;
    this.endDate = followUpForm.endDate;
    this.instructions = followUpForm.instructions;
    this.cohortExpression = followUpForm.cohortExpression;
    this.actionId = followUpForm.actionId;
    this.formId = followUpForm.formId;
    this.form = followUpForm.form;
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
