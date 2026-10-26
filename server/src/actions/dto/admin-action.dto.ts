import { type CohortExpression } from "@alliance/common/cohort-expression";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsDefined, IsOptional } from "class-validator";
import {
  loadedActionFollowUpForms,
  loadedActionFormVariants,
  type ParsedAction,
} from "../entities/action.entity";
import { ActionDto, type ActionDtoExtra } from "./action.dto";
import { AdminFollowUpFormDto } from "./follow-up-form.dto";

/**
 * An action as an admin sees it. A cohort expression names the members an
 * action targets — down to their user ids — so it stays off {@link ActionDto},
 * which members and logged-out clients receive.
 */
export class AdminActionDto extends ActionDto {
  @ApiPropertyOptional({
    description: "Cohort expression tree defining who participates",
    nullable: true,
  })
  @IsOptional()
  @Type(() => Object)
  cohortExpression?: CohortExpression | null;

  // eslint-disable-next-line @darraghor/nestjs-typed/api-property-matches-property-optionality -- without it, @ApiProperty keeps ActionDto's inherited required: false
  @ApiProperty({
    type: () => AdminFollowUpFormDto,
    isArray: true,
    required: true,
  })
  @Allow()
  @Type(() => AdminFollowUpFormDto)
  followUpForms: AdminFollowUpFormDto[];

  @ApiPropertyOptional({
    description:
      "The image column itself: an upload key or an external url, the form an update takes back. `image` is that value rendered as a url.",
  })
  @IsOptional()
  storedImage?: string;

  @ApiPropertyOptional({
    description: "The squareThumbnailImage column itself, like `storedImage`.",
  })
  @IsOptional()
  storedSquareThumbnailImage?: string;

  @ApiProperty()
  @IsDefined()
  staffPreview: boolean;

  @ApiProperty({ type: Number, isArray: true })
  @IsDefined()
  prerequisiteActionIds: number[];

  @ApiProperty({
    type: Date,
    nullable: true,
    description:
      "The latest member_action event, when the action opens to members.",
  })
  @IsOptional()
  memberActionStart: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: "The first event after memberActionStart.",
  })
  @IsOptional()
  memberActionDeadline: Date | null;

  constructor(action: ParsedAction, extra?: ActionDtoExtra) {
    super(action, extra);
    this.cohortExpression = action.cohortExpression;
    this.prerequisiteActionIds = action.prerequisiteActionIds;
    this.memberActionStart = action.memberActionPhase.event?.date ?? null;
    this.memberActionDeadline =
      action.memberActionPhase.deadlineEvent?.date ?? null;
    this.staffPreview = action.staffPreview;
    this.followUpForms = loadedActionFollowUpForms(action).map(
      (form) => new AdminFollowUpFormDto(form),
    );
    this.storedImage = action.image ?? undefined;
    this.storedSquareThumbnailImage = action.squareThumbnailImage ?? undefined;
  }
}

export class AdminActionListItemDto extends AdminActionDto {
  @ApiProperty({
    type: Number,
    isArray: true,
    description: "Forms of the action's variants, besides its task form.",
  })
  @IsDefined()
  variantFormIds: number[];

  constructor(action: ParsedAction, extra?: ActionDtoExtra) {
    super(action, extra);
    this.variantFormIds = loadedActionFormVariants(action).map(
      (variant) => variant.formId,
    );
  }
}
