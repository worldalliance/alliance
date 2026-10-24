/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { type CohortExpression } from "@alliance/common/cohort-expression";
import { HTTP_URL_VALIDATOR_OPTIONS } from "@alliance/common/url";
import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { getImageSource } from "src/images/images.service";
import { Form } from "src/tasks/entities/form.entity";
import { ProfileDto } from "src/user/dto/user.dto";
import { TaskAwayStatus } from "src/utils/action-user";
import { UserActionRelation } from "../action-activity-status";
import { ActionStatus } from "../entities/action-event.entity";
import {
  ACTION_REVIEWERS_MAX,
  ActionReviewer,
  ActionReviewerIcon,
  REVIEWER_NAME_MAX_LENGTH,
  REVIEWER_URL_MAX_LENGTH,
} from "../entities/action-reviewer.entity";
import {
  Action,
  loadedActionFollowUpForms,
  loadedActionFormVariants,
  type ParsedAction,
} from "../entities/action.entity";
import { GeneralUpdate } from "../entities/general-update.entity";
import { ReminderGroup } from "../entities/reminder-group.entity";
import { type UserActionStatus } from "../user-action-status";
import { ActionEventDto } from "./action-event.dto";
import { ActionUpdateDto } from "./action-update.dto";
import { AdminFollowUpFormDto, FollowUpFormDto } from "./follow-up-form.dto";
import { ProjectDto } from "./project.dto";
import { UserActionStatusDto } from "./user-action-status.dto";

export interface ActionSharePreview {
  firstName?: string;
  completedByReferrer: boolean;
  validReferral: boolean;
}

export class ActionSharePreviewDto implements ActionSharePreview {
  @ApiPropertyOptional()
  firstName?: string;

  @ApiProperty({ type: Boolean })
  completedByReferrer: boolean;

  @ApiProperty({ type: Boolean })
  validReferral: boolean;

  constructor(data: ActionSharePreview) {
    this.firstName = data.firstName;
    this.completedByReferrer = data.completedByReferrer;
    this.validReferral = data.validReferral;
  }
}

export class ActionReferralCodeDto {
  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  referralCode: string;

  constructor(referralCode: string) {
    this.referralCode = referralCode;
  }
}

export { UserActionRelation } from "../action-activity-status";

/**
 * The wire shape of a reviewer: the display fields only. Ids and ordering are
 * server-owned, and an update replaces the whole list rather than patching
 * rows, so neither is meaningful to a client.
 *
 * class-transformer instantiates this one with no arguments to validate a
 * request body, so it must stay constructor-less; the outbound half is
 * {@link ActionReviewerResponseDto}.
 */
export class ActionReviewerDto {
  @ApiProperty({ description: "Display name of the reviewer" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(REVIEWER_NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional({
    description: "Link to the reviewer's website, LinkedIn, etc.",
  })
  @IsOptional()
  @IsUrl(HTTP_URL_VALIDATOR_OPTIONS)
  @MaxLength(REVIEWER_URL_MAX_LENGTH)
  url?: string;

  @ApiPropertyOptional({
    enum: ActionReviewerIcon,
    enumName: "ActionReviewerIcon",
    description: "Icon shown next to the reviewer name",
  })
  @IsOptional()
  @IsEnum(ActionReviewerIcon)
  icon?: ActionReviewerIcon;
}

export class ActionReviewerResponseDto extends ActionReviewerDto {
  constructor(input: ActionReviewer) {
    super();
    this.name = input.name;
    this.url = input.url ?? undefined;
    this.icon = input.icon ?? undefined;
  }
}

export type ActionDtoExtra = {
  canParticipate?: boolean;
  shouldParticipate?: boolean;
  userRelation?: UserActionRelation;
  awayStatus?: TaskAwayStatus;
  viewer?: UserActionStatus;
  reqAuthenticated?: boolean;
};

export class ActionDto extends PickType(Action, [
  "id",
  "name",
  "category",
  "image",
  "squareThumbnailImage",
  "squareThumbnailImageAlt",
  "body",
  "shortDescription",
  "timeEstimate",
  "taskFormId",
  "createdAt",
  "updatedAt",
  "isContractSigningAction",
  "visibilityMode",
  "usersJoined",
  "onboarding",
  "archived",
  "priority",
  "optional",
  "preventCompletion",
  "publicOnly",
  "shouldCompleteAfterDeadline",
  "isForumParticipationAction",
  "forumParticipationPostId",
  "forumParticipationIncludeChildren",
  "computedAutocompleteAt",
  "customStatType",
  "customStatLabel",
  "customStatValue",
  "customStatGoal",
  "suite",
]) {
  @ApiProperty({
    type: () => ActionReviewerResponseDto,
    isArray: true,
    description: "Non-user reviewers credited on the action",
    maxItems: ACTION_REVIEWERS_MAX,
  })
  reviewers: ActionReviewerResponseDto[];

  @ApiPropertyOptional({ type: () => FollowUpFormDto, isArray: true })
  @Type(() => FollowUpFormDto)
  followUpForms?: FollowUpFormDto[];

  @ApiProperty()
  usersCompleted: number;

  @ApiProperty({ type: ActionEventDto, isArray: true })
  events: ActionEventDto[];

  @ApiProperty({ enum: ActionStatus, enumName: "ActionStatus" })
  status: ActionStatus;

  @ApiProperty({ type: () => ActionUpdateDto, isArray: true })
  @Type(() => ActionUpdateDto)
  updates: ActionUpdateDto[];

  @ApiPropertyOptional()
  canParticipate?: boolean;

  @ApiPropertyOptional()
  shouldParticipate?: boolean;

  @ApiPropertyOptional({
    enum: UserActionRelation,
    enumName: "UserActionRelation",
  })
  userRelation?: UserActionRelation;

  @ApiPropertyOptional({ enum: TaskAwayStatus, enumName: "TaskAwayStatus" })
  awayStatus?: TaskAwayStatus;

  @ApiPropertyOptional({ type: () => UserActionStatusDto })
  @Type(() => UserActionStatusDto)
  viewer?: UserActionStatusDto;

  @ApiPropertyOptional()
  reqAuthenticated?: boolean;

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  authors?: ProfileDto[];

  @ApiPropertyOptional({ type: () => ProjectDto, nullable: true })
  @Type(() => ProjectDto)
  project?: ProjectDto | null;

  constructor(action: ParsedAction, extra?: ActionDtoExtra) {
    super();
    this.id = action.id;
    this.name = action.name;
    this.category = action.category;
    this.image = action.image ? getImageSource(action.image) : undefined;
    this.squareThumbnailImage = action.squareThumbnailImage
      ? getImageSource(action.squareThumbnailImage)
      : undefined;
    this.squareThumbnailImageAlt = action.squareThumbnailImageAlt;
    this.body = action.body;
    this.shortDescription = action.shortDescription;
    this.timeEstimate = action.timeEstimate;
    this.taskFormId = action.taskFormId;
    this.createdAt = action.createdAt;
    this.updatedAt = action.updatedAt;
    this.isContractSigningAction = action.isContractSigningAction;
    this.visibilityMode = action.visibilityMode;
    this.usersJoined = action.usersJoined;
    this.usersCompleted = action.usersCompleted || 0;
    this.onboarding = action.onboarding;
    this.archived = action.archived;
    this.priority = action.priority;
    this.optional = action.optional;
    this.preventCompletion = action.preventCompletion;
    this.publicOnly = action.publicOnly;
    this.shouldCompleteAfterDeadline = action.shouldCompleteAfterDeadline;
    this.isForumParticipationAction = action.isForumParticipationAction;
    this.forumParticipationPostId = action.forumParticipationPostId;
    this.forumParticipationIncludeChildren =
      action.forumParticipationIncludeChildren;
    this.computedAutocompleteAt = action.computedAutocompleteAt;
    this.customStatType = action.customStatType;
    this.customStatLabel = action.customStatLabel;
    this.customStatValue = action.customStatValue;
    this.customStatGoal = action.customStatGoal;
    this.followUpForms = action.followUpForms?.map(
      (form) => new FollowUpFormDto(form),
    );
    if (!action.reviewers) {
      throw new Error("`reviewers` relation is not loaded");
    }
    this.reviewers = [...action.reviewers]
      .sort((a, b) => a.position - b.position)
      .map((reviewer) => new ActionReviewerResponseDto(reviewer));
    this.suite = action.suite;
    this.project = action.project && new ProjectDto(action.project);
    this.status = (action.events && action.status) ?? ActionStatus.Draft;
    this.events =
      action.events?.map((event) => new ActionEventDto(event)) || [];
    this.updates =
      action.updates?.map((update) => new ActionUpdateDto(update)) || [];
    this.canParticipate = extra?.canParticipate;
    this.shouldParticipate = extra?.shouldParticipate;
    this.userRelation = extra?.userRelation;
    this.awayStatus = extra?.awayStatus;
    this.viewer = extra?.viewer
      ? new UserActionStatusDto(extra.viewer)
      : undefined;
    this.reqAuthenticated = extra?.reqAuthenticated;
    this.authors =
      action.authors?.map((author) => new ProfileDto(author)) || [];
  }
}

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

export class CreateActionDto extends IntersectionType(
  PickType(Action, ["cohortExpression"]),
  PickType(ActionDto, [
    "name",
    "category",
    "image",
    "squareThumbnailImage",
    "body",
    "shortDescription",
    "taskFormId",
    "isContractSigningAction",
    "visibilityMode",
    "onboarding",
    "optional",
    "preventCompletion",
    "publicOnly",
    "shouldCompleteAfterDeadline",
    "isForumParticipationAction",
    "customStatType",
    "customStatLabel",
    "customStatValue",
    "customStatGoal",
  ]),
  PartialType(
    PickType(ActionDto, [
      "squareThumbnailImageAlt",
      "timeEstimate",
      "forumParticipationPostId",
      "forumParticipationIncludeChildren",
      "computedAutocompleteAt",
    ]),
  ),
) {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
  })
  @IsOptional()
  suiteId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  staffPreview?: boolean;

  @ApiPropertyOptional({
    type: () => ActionReviewerDto,
    isArray: true,
    maxItems: ACTION_REVIEWERS_MAX,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ACTION_REVIEWERS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ActionReviewerDto)
  reviewers?: ActionReviewerDto[];

  @ApiPropertyOptional({
    type: Number,
    isArray: true,
  })
  @IsOptional()
  authorIds?: number[];

  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description:
      "Actions each member waits for before this action's cohort decides them",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  prerequisiteActionIds?: number[];
}

export class UpdateActionDto extends PartialType(CreateActionDto, {
  skipNullProperties: false,
}) {}

export class SetActionPriorityDto extends PickType(Action, [
  "id",
  "priority",
]) {}

export class SetGeneralUpdatePriorityDto extends PickType(GeneralUpdate, [
  "id",
  "priority",
]) {}

export class SetPriorityDto {
  @ApiProperty({ type: () => SetActionPriorityDto, isArray: true })
  @Type(() => SetActionPriorityDto)
  @IsArray()
  actionPriorities: SetActionPriorityDto[];

  @ApiProperty({ type: () => SetGeneralUpdatePriorityDto, isArray: true })
  @Type(() => SetGeneralUpdatePriorityDto)
  @IsArray()
  generalUpdatePriorities: SetGeneralUpdatePriorityDto[];
}

export class LatLonDto {
  @ApiProperty({ type: Number })
  latitude: number;

  @ApiProperty({ type: Number })
  longitude: number;
}

export class UserActionRelationDto {
  @ApiProperty({ enum: UserActionRelation, enumName: "UserActionRelation" })
  relation: UserActionRelation;

  constructor(relation: UserActionRelation) {
    this.relation = relation;
  }
}

export class ActionRelationsDto {
  @ApiProperty({ type: () => Map<number, UserActionRelation> })
  relations: Map<number, UserActionRelation>;
}

export class ExportActionDto extends OmitType(Action, [
  "deadlineWeekNumber",
  "memberActionPhase",
  "status",
  "usersJoined",
  "usersCompleted",
  "formVariants",
  "legacyReviewers",
]) {
  @ApiPropertyOptional({ type: () => Form })
  @Type(() => Form)
  @IsOptional()
  taskForm?: Form;

  @ApiPropertyOptional({ type: () => ReminderGroup, isArray: true })
  @Type(() => ReminderGroup)
  @IsOptional()
  reminderGroups?: ReminderGroup[];

  constructor(
    action?: Action,
    extra?: {
      taskForm?: Form;
      reminderGroups?: ReminderGroup[];
    },
  ) {
    super();
    if (!action) {
      return;
    }
    Object.assign(this, action);
    this.taskForm = extra?.taskForm;
    this.reminderGroups = extra?.reminderGroups;
  }
}

export class PasteJsonDto {
  @ApiProperty()
  @IsString()
  body: string;
}

export class EvaluateCohortExpressionDto {
  // eslint-disable-next-line @darraghor/nestjs-typed/all-properties-have-explicit-defined
  @ApiProperty({ description: "Cohort expression to evaluate" })
  @IsDefined()
  expression: unknown;
}

export class EvaluateCohortExpressionResponseDto {
  @ApiProperty({
    type: Number,
    isArray: true,
  })
  @IsArray()
  userIds: number[];

  constructor(userIds: number[]) {
    this.userIds = userIds;
  }
}
