/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
  WITHDRAWAL_OPTIONS,
  type FeedActionActivity,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { type CohortExpression } from "@alliance/common/cohort-expression";
import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
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
import { CommentDto } from "src/forum/dto/comment.dto";
import type { ForumFeedComment } from "src/forum/forum-comment-query.service";
import { getImageSource } from "src/images/images.service";
import { Form } from "src/tasks/entities/form.entity";
import { UserActionRelationPillStatus } from "src/user/dto/user-action-relations.dto";
import { ProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import { TaskAwayStatus } from "src/utils/action-user";
import { UserActionRelation } from "../action-activity-status";
import { ActionEvent, ActionStatus } from "../entities/action-event.entity";
import {
  ACTION_REVIEWERS_MAX,
  ActionReviewer,
  ActionReviewerIcon,
  REVIEWER_NAME_MAX_LENGTH,
  REVIEWER_URL_MAX_LENGTH,
} from "../entities/action-reviewer.entity";
import { ActionSuite } from "../entities/action-suite.entity";
import { ActionUpdate } from "../entities/action-update.entity";
import {
  Action,
  loadedActionEvents,
  loadedActionFollowUpForms,
  loadedActionFormVariants,
  type ParsedAction,
} from "../entities/action.entity";
import { GeneralUpdate } from "../entities/general-update.entity";
import { ReminderGroup } from "../entities/reminder-group.entity";
import {
  ViewerActionRelation,
  ViewerOptionalReason,
  type UserActionStatus,
  type UserActionWithdrawal,
} from "../user-action-status";
import { ActionActivityDto } from "./action-activity.dto";
import { ActionEventDto } from "./action-event.dto";
import { ActionUpdateDto } from "./action-update.dto";
import { AdminFollowUpFormDto, FollowUpFormDto } from "./follow-up-form.dto";
import { GeneralUpdateDto } from "./general-update.dto";
import { ProjectDto } from "./project.dto";
import { ReminderGroupDto } from "./reminder-group.dto";

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

export class CreateActionSuiteDto extends PickType(ActionSuite, ["name"]) {}

export class ActionSuiteDto extends PickType(ActionSuite, ["id", "name"]) {
  @ApiProperty({ type: () => ActionDto, isArray: true })
  @Type(() => ActionDto)
  @Allow()
  actions: ActionDto[];

  @ApiProperty({ type: () => ActionEventDto, isArray: true })
  @Type(() => ActionEventDto)
  @Allow()
  events: ActionEventDto[];

  @ApiProperty({ type: () => ReminderGroupDto, isArray: true })
  @Type(() => ReminderGroupDto)
  @Allow()
  reminderGroups: ReminderGroupDto[];

  @ApiProperty({ type: () => GeneralUpdateDto, isArray: true })
  @Type(() => GeneralUpdateDto)
  @Allow()
  generalUpdates: GeneralUpdateDto[];

  constructor(suite: ActionSuite, actions: ParsedAction[]) {
    super();
    this.id = suite.id;
    this.name = suite.name;
    this.actions = actions.map((action) => new ActionDto(action));
    // Suite events are stored as per-action duplicate rows tagged suiteManaged;
    // we surface actions[0]'s copies as canonical. Brittle if actions drift —
    // any divergence (extra/missing rows, reordering) is invisible here.
    this.events = actions.length
      ? loadedActionEvents(actions[0])
          .filter((event) => event.suiteManaged)
          .map((event) => new ActionEventDto(event))
      : [];
    this.reminderGroups =
      suite.reminderGroups?.map((group) => new ReminderGroupDto(group)) ?? [];
    this.generalUpdates =
      suite.generalUpdates?.map((update) => new GeneralUpdateDto(update)) ?? [];
  }
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

export type SuspensionPlan = { date: Date; users: User[] };

export class SuspensionPlanDto {
  @ApiProperty({ type: Date })
  @IsDefined()
  @Type(() => Date)
  date: Date;

  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  @IsDefined()
  users: ProfileDto[];

  constructor(input: SuspensionPlan) {
    this.date = input.date;
    this.users = input.users.map((user) => new ProfileDto(user));
  }
}

export class ActionSummaryDto extends PickType(Action, ["id", "name"]) {
  constructor(action: Pick<Action, "id" | "name">) {
    super();
    this.id = action.id;
    this.name = action.name;
  }
}

export type ForumAutocompletePlan = SuspensionPlan & {
  action: Action;
};

export class ForumAutocompletePlanDto extends SuspensionPlanDto {
  @ApiProperty({ type: () => ActionSummaryDto })
  @Type(() => ActionSummaryDto)
  @IsDefined()
  action: ActionSummaryDto;

  constructor(input: ForumAutocompletePlan) {
    super({ date: input.date, users: input.users });
    this.action = new ActionSummaryDto(input.action);
  }
}

export class ScheduledPlansOverviewDto {
  @ApiProperty({ type: () => SuspensionPlanDto, isArray: true })
  @Type(() => SuspensionPlanDto)
  @IsDefined()
  suspensionPlans: SuspensionPlanDto[];

  @ApiProperty({ type: () => ForumAutocompletePlanDto, isArray: true })
  @Type(() => ForumAutocompletePlanDto)
  @IsDefined()
  forumAutocompletePlans: ForumAutocompletePlanDto[];

  constructor(input: {
    suspensionPlans: SuspensionPlan[];
    forumAutocompletePlans: ForumAutocompletePlan[];
  }) {
    this.suspensionPlans = input.suspensionPlans.map(
      (plan) => new SuspensionPlanDto(plan),
    );
    this.forumAutocompletePlans = input.forumAutocompletePlans.map(
      (plan) => new ForumAutocompletePlanDto(plan),
    );
  }
}

export enum GlobalFeedItemType {
  ActivityGroup = "activity_group",
  ActionUpdate = "action_update",
  NewMembers = "new_members",
  ForumComments = "forum_comments",
}

export class GlobalFeedActivityGroupDto {
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty({
    enum: ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
    enumName: "GlobalFeedActivityTypes",
  })
  activityType: FeedActionActivity;

  @ApiProperty()
  count: number;
}

export class GlobalFeedActionUpdateDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  @Type(() => Object)
  schema: DisplayOnlySchema;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;
}

export class GlobalFeedNewMembersDto {
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiProperty()
  count: number;
}

export class GlobalFeedForumCommentsDto {
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiProperty()
  postId: number;

  @ApiProperty()
  postTitle: string;

  @ApiProperty()
  count: number;

  @ApiPropertyOptional()
  commentId?: number;
}

export type GlobalFeedItem = {
  date: Date;
} & (
  | {
      type: GlobalFeedItemType.ActivityGroup;
      activityGroup: GlobalFeedActivityGroupDto;
      actionUpdate?: undefined;
      newMembers?: undefined;
      forumComments?: undefined;
    }
  | {
      type: GlobalFeedItemType.ActionUpdate;
      activityGroup?: undefined;
      actionUpdate: GlobalFeedActionUpdateDto;
      newMembers?: undefined;
      forumComments?: undefined;
    }
  | {
      type: GlobalFeedItemType.NewMembers;
      activityGroup?: undefined;
      actionUpdate?: undefined;
      newMembers: GlobalFeedNewMembersDto;
      forumComments?: undefined;
    }
  | {
      type: GlobalFeedItemType.ForumComments;
      activityGroup?: undefined;
      actionUpdate?: undefined;
      newMembers?: undefined;
      forumComments: GlobalFeedForumCommentsDto;
    }
);

export class GlobalFeedItemDto {
  @ApiProperty({ enum: GlobalFeedItemType, enumName: "GlobalFeedItemType" })
  @Allow()
  type: GlobalFeedItemType;

  @ApiProperty()
  @Type(() => Date)
  @Allow()
  date: Date;

  @ApiPropertyOptional({ type: () => GlobalFeedActivityGroupDto })
  @Type(() => GlobalFeedActivityGroupDto)
  @IsOptional()
  activityGroup?: GlobalFeedActivityGroupDto;

  @ApiPropertyOptional({ type: () => GlobalFeedActionUpdateDto })
  @Type(() => GlobalFeedActionUpdateDto)
  @IsOptional()
  actionUpdate?: GlobalFeedActionUpdateDto;

  @ApiPropertyOptional({ type: () => GlobalFeedNewMembersDto })
  @Type(() => GlobalFeedNewMembersDto)
  @IsOptional()
  newMembers?: GlobalFeedNewMembersDto;

  @ApiPropertyOptional({ type: () => GlobalFeedForumCommentsDto })
  @Type(() => GlobalFeedForumCommentsDto)
  @IsOptional()
  forumComments?: GlobalFeedForumCommentsDto;

  constructor(input: GlobalFeedItem) {
    this.type = input.type;
    this.date = input.date;
    if (input.type === GlobalFeedItemType.ActivityGroup) {
      this.activityGroup = input.activityGroup;
    } else if (input.type === GlobalFeedItemType.ActionUpdate) {
      this.actionUpdate = input.actionUpdate;
    } else if (input.type === GlobalFeedItemType.NewMembers) {
      this.newMembers = input.newMembers;
    } else if (input.type === GlobalFeedItemType.ForumComments) {
      this.forumComments = input.forumComments;
    }
  }
}

export enum TimelineFeedItemType {
  ActionUpdate = "action_update",
  ActionEvent = "action_event",
}

export type TimelineFeedItem = {
  date: Date;
  action: ParsedAction;
} & (
  | {
      type: TimelineFeedItemType.ActionEvent;
      actionEvent: ActionEvent;
      actionUpdate?: undefined;
    }
  | {
      type: TimelineFeedItemType.ActionUpdate;
      actionEvent?: undefined;
      actionUpdate: ActionUpdate;
    }
);

export class TimelineFeedItemDto {
  @ApiProperty({ enum: TimelineFeedItemType, enumName: "TimelineFeedItemType" })
  @Allow()
  type: TimelineFeedItemType;

  @ApiProperty()
  @Type(() => Date)
  @Allow()
  date: Date;

  @ApiProperty({ type: () => ActionDto })
  @Type(() => ActionDto)
  @Allow()
  action: ActionDto;

  @ApiPropertyOptional({ type: () => ActionUpdateDto })
  @Type(() => ActionUpdateDto)
  @IsOptional()
  actionUpdate?: ActionUpdateDto;

  @ApiPropertyOptional({ type: () => ActionEventDto })
  @Type(() => ActionEventDto)
  @IsOptional()
  actionEvent?: ActionEventDto;

  constructor(input: TimelineFeedItem) {
    this.type = input.type;
    this.date = input.date;
    this.action = new ActionDto(input.action);
    switch (input.type) {
      case TimelineFeedItemType.ActionEvent:
        this.actionEvent = new ActionEventDto(input.actionEvent);
        break;
      case TimelineFeedItemType.ActionUpdate:
        this.actionUpdate = new ActionUpdateDto(input.actionUpdate);
        break;
      default:
        input satisfies never;
        throw new Error(
          `Unknown timeline feed item type: ${(input as { type: unknown }).type}`,
        );
    }
  }
}

export enum HomeFeedItemType {
  Activity = "activity",
  ForumComment = "forum_comment",
}

export class HomeFeedForumCommentDto {
  @ApiProperty({ type: () => CommentDto })
  @Type(() => CommentDto)
  comment: CommentDto;

  @ApiProperty()
  postId: number;

  @ApiProperty()
  postTitle: string;

  @ApiProperty()
  likedByMe: boolean;

  @ApiProperty()
  likesCount: number;

  constructor(input: ForumFeedComment) {
    this.comment = new CommentDto(input.comment, { facepile: input.facepile });
    this.postId = input.postId;
    this.postTitle = input.postTitle;
    this.likedByMe = input.likedByMe;
    this.likesCount = input.likesCount;
  }
}

export type HomeFeedItem = {
  date: Date;
} & (
  | {
      type: HomeFeedItemType.Activity;
      activity: ActionActivityDto;
      forumComment?: undefined;
    }
  | {
      type: HomeFeedItemType.ForumComment;
      activity?: undefined;
      forumComment: ForumFeedComment;
    }
);

export class HomeFeedItemDto {
  @ApiProperty({ enum: HomeFeedItemType, enumName: "HomeFeedItemType" })
  @Allow()
  type: HomeFeedItemType;

  @ApiProperty()
  @Type(() => Date)
  @Allow()
  date: Date;

  @ApiPropertyOptional({ type: () => ActionActivityDto })
  @Type(() => ActionActivityDto)
  @IsOptional()
  activity?: ActionActivityDto;

  @ApiPropertyOptional({ type: () => HomeFeedForumCommentDto })
  @Type(() => HomeFeedForumCommentDto)
  @IsOptional()
  forumComment?: HomeFeedForumCommentDto;

  constructor(input: HomeFeedItem) {
    this.type = input.type;
    this.date = input.date;
    switch (input.type) {
      case HomeFeedItemType.Activity:
        this.activity = input.activity;
        break;
      case HomeFeedItemType.ForumComment:
        this.forumComment = new HomeFeedForumCommentDto(input.forumComment);
        break;
      default:
        input satisfies never;
        throw new Error(
          `Unknown home feed item type: ${(input as { type: unknown }).type}`,
        );
    }
  }
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
