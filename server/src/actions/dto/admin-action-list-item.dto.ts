import { ApiProperty } from "@nestjs/swagger";
import { IsDefined } from "class-validator";
import type { ActionResponseCounts } from "../action-response-counts.service";
import { loadedActionBranches } from "../entities/action-branch.entity";
import {
  loadedActionFormVariants,
  type ParsedAction,
} from "../entities/action.entity";
import { AdminActionDto } from "./admin-action.dto";

export type AdminActionListItem = {
  action: ParsedAction;
  responseCounts: ActionResponseCounts;
};

export class AdminActionListItemDto extends AdminActionDto {
  @ApiProperty({
    type: Number,
    isArray: true,
    description: "Forms of the action's variants, besides its task form.",
  })
  @IsDefined()
  variantFormIds: number[];

  @ApiProperty({
    type: Number,
    isArray: true,
    description: "Forms of the action's branches, besides its task form.",
  })
  @IsDefined()
  branchFormIds: number[];

  @ApiProperty({
    description: "Members whose latest response is a withdrawal.",
  })
  @IsDefined()
  usersWontComplete: number;

  @ApiProperty({
    description:
      "Members who dismissed the action's card without completing or withdrawing.",
  })
  @IsDefined()
  usersDismissed: number;

  constructor(input: AdminActionListItem) {
    super(input.action);
    this.variantFormIds = loadedActionFormVariants(input.action).map(
      (variant) => variant.formId,
    );
    this.branchFormIds = loadedActionBranches(input.action).map(
      (branch) => branch.formId,
    );
    this.usersWontComplete = input.responseCounts.usersWontComplete;
    this.usersDismissed = input.responseCounts.usersDismissed;
  }
}
