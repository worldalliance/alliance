import { ActionActivityType } from '@alliance/common/actionActivity';
import { byLikeOrder, LIKE_FACEPILE_LIMIT } from '@alliance/common/likeOrder';
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CommentDto } from 'src/forum/dto/comment.dto';
import {
  CreateEditableContentDto,
  EditableContentDto,
} from 'src/forum/dto/editablecontent.dto';
import type { Comment } from 'src/forum/entities/comment.entity';
import { getImageSource } from 'src/images/images.service';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { SubmitFormDto } from 'src/tasks/form.dto';
import { ProfileDto } from 'src/user/dto/user.dto';
import { User } from 'src/user/entities/user.entity';
import { TaskAwayStatus } from 'src/utils/action-user';
import type { CohortExpression } from '../cohort-expression.types';
import { ActionActivity } from '../entities/action-activity.entity';
import { ActionEvent, ActionStatus } from '../entities/action-event.entity';
import { ActionSuite } from '../entities/action-suite.entity';
import { ActionUpdate } from '../entities/action-update.entity';
import { Action } from '../entities/action.entity';
import { GeneralUpdate } from '../entities/general-update.entity';
import {
  ReminderCohortType,
  ReminderGroup,
} from '../entities/reminder-group.entity';
import { GeneralUpdateDto } from './general-update.dto';

export class CreateReminderGroupDto extends PickType(ReminderGroup, [
  'name',
  'emailMessage',
  'cohortType',
  'timingMode',
  'emailSubject',
  'textMessage',
  'pushMessage',
  'sendAtAbsolute',
  'sendAtSecondsFromDeadline',
  'send_range_start',
  'send_range_end',
  'relative_range_start_seconds_from_deadline',
  'relative_range_end_seconds_from_deadline',
  'useSuiteTaskCount',
  'excludeOptionalActions',
  'excludePreviouslyNotified',
]) {
  @ApiPropertyOptional({ type: Number, isArray: true })
  @IsOptional()
  userIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  userTagId?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  suiteId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  timingAnchorEventId?: number;
}

export class PreviewEmailHtmlDto extends PickType(CreateReminderGroupDto, [
  'emailMessage',
  'emailSubject',
]) {
  @ApiProperty({ type: Number })
  @IsDefined()
  @IsNumber()
  taskCount: number;

  @ApiPropertyOptional({ enum: ReminderCohortType })
  @IsOptional()
  @IsEnum(ReminderCohortType)
  cohortType?: ReminderCohortType;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  uncompletedMembersInGroupCount?: number;
}

export class PreviewTextDto extends PickType(CreateReminderGroupDto, [
  'textMessage',
]) {
  @ApiProperty({ type: Number })
  @IsDefined()
  @IsNumber()
  taskCount: number;

  @ApiPropertyOptional({ enum: ReminderCohortType })
  @IsOptional()
  @IsEnum(ReminderCohortType)
  cohortType?: ReminderCohortType;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  uncompletedMembersInGroupCount?: number;
}

export class PreviewTextMessageResponseDto {
  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  text: string;

  constructor(text: string) {
    this.text = text;
  }
}

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

export interface PreviewEmailHtmlResponse {
  subject: string;
  html: string;
}

export class PreviewEmailHtmlResponseDto implements PreviewEmailHtmlResponse {
  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  subject: string;

  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  html: string;

  constructor(data: PreviewEmailHtmlResponse) {
    this.subject = data.subject;
    this.html = data.html;
  }
}

export class ActionEventDto extends PickType(ActionEvent, [
  'id',
  'title',
  'description',
  'newStatus',
  'suiteManaged',
  'date',
]) {
  constructor(event: ActionEvent) {
    super();
    this.id = event.id;
    this.title = event.title;
    this.description = event.description;
    this.newStatus = event.newStatus;
    this.suiteManaged = event.suiteManaged;
    this.date = event.date;
  }
}

export class CreateActionEventDto extends OmitType(ActionEventDto, [
  'id',
  'suiteManaged',
]) {}

export class UpdateActionEventDto extends PartialType(CreateActionEventDto) {}

export enum UserActionRelation {
  Completed = 'completed',
  None = 'none',
  Declined = 'declined',
  Dismissed = 'dismissed',
}

export class ActionDto extends PickType(Action, [
  'id',
  'name',
  'category',
  'image',
  'squareThumbnailImage',
  'squareThumbnailImageAlt',
  'donationAmount',
  'body',
  'taskContents',
  'shortDescription',
  'timeEstimate',
  'type',
  'taskFormId',
  'createdAt',
  'updatedAt',
  'cohortExpression',
  'isContractSigningAction',
  'visibilityMode',
  'usersJoined',
  'onboarding',
  'archived',
  'priority',
  'optional',
  'preventCompletion',
  'publicOnly',
  'shouldCompleteAfterDeadline',
  'isForumParticipationAction',
  'forumParticipationPostId',
  'forumParticipationIncludeChildren',
  'computedAutocompleteAt',
  'customStatType',
  'customStatLabel',
  'customStatValue',
  'customStatGoal',
  'followUpForms',
  'suite',
]) {
  @ApiProperty()
  usersCompleted: number;

  @ApiProperty({ type: ActionEventDto, isArray: true })
  events: ActionEventDto[];

  @ApiProperty({ enum: ActionStatus, enumName: 'ActionStatus' })
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
    enumName: 'UserActionRelation',
  })
  userRelation?: UserActionRelation;

  @ApiPropertyOptional({ enum: TaskAwayStatus, enumName: 'TaskAwayStatus' })
  awayStatus?: TaskAwayStatus;

  @ApiPropertyOptional()
  reqAuthenticated?: boolean;

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  authors?: ProfileDto[];

  constructor(
    action: Action,
    extra?: {
      canParticipate?: boolean;
      shouldParticipate?: boolean;
      userRelation?: UserActionRelation;
      awayStatus?: TaskAwayStatus;
      reqAuthenticated?: boolean;
    },
  ) {
    super();
    this.id = action.id;
    this.name = action.name;
    this.category = action.category;
    this.image = action.image ? getImageSource(action.image) : undefined;
    this.squareThumbnailImage = action.squareThumbnailImage
      ? getImageSource(action.squareThumbnailImage)
      : undefined;
    this.squareThumbnailImageAlt =
      action.squareThumbnailImageAlt ?? action.name;
    this.donationAmount = action.donationAmount;
    this.body = action.body;
    this.taskContents = action.taskContents;
    this.shortDescription = action.shortDescription;
    this.timeEstimate = action.timeEstimate;
    this.type = action.type;
    this.taskFormId = action.taskFormId;
    this.createdAt = action.createdAt;
    this.updatedAt = action.updatedAt;
    this.cohortExpression = action.cohortExpression;
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
    this.followUpForms = action.followUpForms;
    this.suite = action.suite;
    this.status = (action.events && action.status) ?? ActionStatus.Draft;
    this.events =
      action.events?.map((event) => new ActionEventDto(event)) || [];
    this.updates =
      action.updates?.map((update) => new ActionUpdateDto(update)) || [];
    this.canParticipate = extra?.canParticipate;
    this.shouldParticipate = extra?.shouldParticipate;
    this.userRelation = extra?.userRelation;
    this.awayStatus = extra?.awayStatus;
    this.reqAuthenticated = extra?.reqAuthenticated;
    this.authors =
      action.authors?.map((author) => new ProfileDto(author)) || [];
  }
}

export class CreateActionDto extends PickType(ActionDto, [
  'name',
  'category',
  'image',
  'squareThumbnailImage',
  'squareThumbnailImageAlt',
  'donationAmount',
  'body',
  'shortDescription',
  'timeEstimate',
  'type',
  'taskFormId',
  'cohortExpression',
  'isContractSigningAction',
  'visibilityMode',
  'onboarding',
  'optional',
  'preventCompletion',
  'publicOnly',
  'shouldCompleteAfterDeadline',
  'isForumParticipationAction',
  'forumParticipationPostId',
  'forumParticipationIncludeChildren',
  'computedAutocompleteAt',
  'customStatType',
  'customStatLabel',
  'customStatValue',
  'customStatGoal',
  'followUpForms',
]) {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
  })
  @IsOptional()
  suiteId?: number | null;

  @ApiPropertyOptional({
    type: Number,
    isArray: true,
  })
  @IsOptional()
  authorIds?: number[];
}

export class UpdateActionDto extends PartialType(CreateActionDto) {}

export class SetActionPriorityDto extends PickType(Action, [
  'id',
  'priority',
]) {}

export class SetGeneralUpdatePriorityDto extends PickType(GeneralUpdate, [
  'id',
  'priority',
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

export class OptOutActionDto {
  @ApiProperty({ type: Number })
  @IsDefined()
  @IsNumber()
  actionId: number;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsBoolean()
  outOfTime: boolean;

  @ApiProperty()
  @IsDefined()
  @IsBoolean()
  isMoral: boolean;

  @ApiPropertyOptional({ type: Object })
  @Type(() => Object)
  @IsOptional()
  partialFormData?: SubmitFormDto;
}

export class FormResponseOutputDto extends PickType(FormResponse, [
  'id',
  'answers',
  'formId',
  'visibilityValidatorResults',
  'deviceType',
  'publicAnswers',
]) {
  @ApiProperty()
  @Type(() => Object)
  schemaSnapshot: Record<string, unknown>;

  constructor(formResponse: FormResponse) {
    super();
    this.id = formResponse.id;
    this.answers = formResponse.answers;
    this.formId = formResponse.formId;
    this.visibilityValidatorResults = formResponse.visibilityValidatorResults;
    this.deviceType = formResponse.deviceType;
    this.publicAnswers = formResponse.publicAnswers;
    this.schemaSnapshot = formResponse.formSnapshot.schema;
  }
}

export class ActionActivityDto extends PickType(ActionActivity, [
  'id',
  'type',
  'createdAt',
  'actionId',
  'likesCount',
]) {
  @ApiProperty({ type: () => ProfileDto })
  @Type(() => ProfileDto)
  @Allow()
  user: ProfileDto;

  @ApiProperty()
  @Allow()
  actionName: string;

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  @IsOptional()
  likes?: ProfileDto[];

  @ApiPropertyOptional()
  @IsOptional()
  likedByMe?: boolean;

  @ApiProperty({ type: () => CommentDto, isArray: true })
  @Type(() => CommentDto)
  @Allow()
  comments: CommentDto[];

  @ApiPropertyOptional({ type: () => FormResponseOutputDto })
  @Type(() => FormResponseOutputDto)
  @IsOptional()
  formResponseOutput?: FormResponseOutputDto;

  @ApiProperty({ type: () => EditableContentDto })
  @Type(() => EditableContentDto)
  @Allow()
  editableContent: EditableContentDto;

  constructor(
    actionActivity: ActionActivity,
    extra?: {
      comments?: Comment[];
      formResponseOutput?: FormResponse;
      likedByMe?: boolean;
      requestingUserId?: number;
    },
  ) {
    super();
    this.id = actionActivity.id;
    this.type = actionActivity.type;
    this.createdAt = actionActivity.createdAt;
    this.actionId = actionActivity.actionId;
    this.likesCount = actionActivity.likesCount;
    this.actionName = actionActivity.action?.name;
    this.user = new ProfileDto(actionActivity.user);
    if (actionActivity.likes !== undefined) {
      this.likes = actionActivity.likes
        .map((like) => new ProfileDto(like))
        .sort(byLikeOrder(actionActivity.id))
        .slice(0, LIKE_FACEPILE_LIMIT);
    }
    this.likedByMe = extra?.likedByMe;
    this.comments =
      extra?.comments?.map(
        (comment) => new CommentDto(comment, extra?.requestingUserId),
      ) ?? [];
    this.formResponseOutput = extra?.formResponseOutput
      ? new FormResponseOutputDto(extra.formResponseOutput)
      : undefined;
    this.editableContent = actionActivity.editableContent
      ? new EditableContentDto(actionActivity.editableContent)
      : { body: '', attachments: [], id: -1 };
  }
}

export type UnwelcomedSignedContractMember = {
  user: User;
  actionId: number;
  activityId: number;
  signedAt: Date;
  completedAt: Date;
  staffLikeCount: number;
};

export class UnwelcomedSignedContractMemberDto {
  @ApiProperty({ type: () => ProfileDto })
  @Type(() => ProfileDto)
  user: ProfileDto;

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  activityId: number;

  @ApiProperty()
  signedAt: Date;

  @ApiProperty()
  completedAt: Date;

  @ApiProperty()
  staffLikeCount: number;

  constructor(input: UnwelcomedSignedContractMember) {
    this.user = new ProfileDto(input.user);
    this.actionId = input.actionId;
    this.activityId = input.activityId;
    this.signedAt = input.signedAt;
    this.completedAt = input.completedAt;
    this.staffLikeCount = input.staffLikeCount;
  }
}

export class UserActionRelationDto {
  @ApiProperty({ enum: UserActionRelation, enumName: 'UserActionRelation' })
  relation: UserActionRelation;

  constructor(relation: UserActionRelation) {
    this.relation = relation;
  }
}

export class CreateActionActivityDto extends PickType(ActionActivityDto, [
  'actionId',
  'type',
]) {
  @ApiProperty()
  @IsNumber()
  userId: number;
}

export class UpdateActionActivityDto extends PickType(ActionActivityDto, [
  'editableContent',
]) {}

export class ActionRelationsDto {
  @ApiProperty({ type: () => Map<number, UserActionRelation> })
  relations: Map<number, UserActionRelation>;
}

export class ActionUpdateDto extends PickType(ActionUpdate, [
  'id',
  'title',
  'date',
  'actionId',
  'visibleAt',
  'notifyType',
  'shortNotifString',
  'associatedEvent',
  'associatedEventId',
  'tag',
]) {
  @ApiProperty({ type: () => EditableContentDto })
  @Type(() => EditableContentDto)
  @Allow()
  content: EditableContentDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  actionName?: string;

  constructor(actionUpdate: ActionUpdate) {
    super();
    this.id = actionUpdate.id;
    this.title = actionUpdate.title;
    this.date = actionUpdate.date;
    this.actionId = actionUpdate.actionId;
    this.visibleAt = actionUpdate.visibleAt;
    this.notifyType = actionUpdate.notifyType;
    this.shortNotifString = actionUpdate.shortNotifString;
    this.associatedEvent = actionUpdate.associatedEvent;
    this.associatedEventId = actionUpdate.associatedEventId;
    this.tag = actionUpdate.tag;
    this.content = actionUpdate.content
      ? new EditableContentDto(actionUpdate.content)
      : { body: '', attachments: [], id: -1 };
    this.actionName = actionUpdate.action?.name;
  }
}

export class CreateActionUpdateDto extends PickType(ActionUpdate, [
  'title',
  'date',
  'visibleAt',
  'notifyType',
  'shortNotifString',
]) {
  @ApiProperty({ type: () => CreateEditableContentDto })
  @Type(() => CreateEditableContentDto)
  @IsDefined()
  content: CreateEditableContentDto;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  associatedEventId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  tagId?: string;
}

export class CreateActionSuiteDto extends PickType(ActionSuite, ['name']) {}

export class ReminderGroupDto extends PickType(ReminderGroup, [
  'id',
  'name',
  'timingMode',
  'actionSuite',
  'memberActionEvent',
  'cohortType',
  'userTag',
  'users',
  'emailMessage',
  'emailSubject',
  'textMessage',
  'pushMessage',
  'send_range_start',
  'send_range_end',
  'sendAtAbsolute',
  'sendAtSecondsFromDeadline',
  'relative_range_start_seconds_from_deadline',
  'relative_range_end_seconds_from_deadline',
  'deadlineEvent',
  'timingAnchorEvent',
  'useSuiteTaskCount',
  'allSent',
  'excludeOptionalActions',
  'excludePreviouslyNotified',
]) {
  constructor(group: ReminderGroup) {
    super();
    this.id = group.id;
    this.name = group.name;
    this.timingMode = group.timingMode;
    this.actionSuite = group.actionSuite;
    this.memberActionEvent = group.memberActionEvent;
    this.cohortType = group.cohortType;
    this.userTag = group.userTag;
    this.users = group.users;
    this.emailMessage = group.emailMessage;
    this.emailSubject = group.emailSubject;
    this.textMessage = group.textMessage;
    this.pushMessage = group.pushMessage;
    this.send_range_start = group.send_range_start;
    this.send_range_end = group.send_range_end;
    this.sendAtAbsolute = group.sendAtAbsolute;
    this.sendAtSecondsFromDeadline = group.sendAtSecondsFromDeadline;
    this.relative_range_start_seconds_from_deadline =
      group.relative_range_start_seconds_from_deadline;
    this.relative_range_end_seconds_from_deadline =
      group.relative_range_end_seconds_from_deadline;
    this.deadlineEvent = group.deadlineEvent;
    this.timingAnchorEvent = group.timingAnchorEvent;
    this.useSuiteTaskCount = group.useSuiteTaskCount;
    this.allSent = group.allSent;
    this.excludeOptionalActions = group.excludeOptionalActions;
    this.excludePreviouslyNotified = group.excludePreviouslyNotified;
  }
}

/**
 * A dependency action's deadline event, offered as a reminder-group timing
 * anchor (`ReminderGroup.timingAnchorEvent`). Dependencies are derived from
 * the action's cohort expression (form-response and completed/in-progress
 * action conditions).
 */
export type ReminderAnchorCandidate = {
  actionId: number;
  actionName: string;
  deadlineEventId: number;
  deadlineEventDate: Date;
};

export class ReminderAnchorCandidateDto {
  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty()
  deadlineEventId: number;

  @ApiProperty({ type: Date })
  deadlineEventDate: Date;

  constructor(input: ReminderAnchorCandidate) {
    this.actionId = input.actionId;
    this.actionName = input.actionName;
    this.deadlineEventId = input.deadlineEventId;
    this.deadlineEventDate = input.deadlineEventDate;
  }
}

export class ActionSuiteDto extends PickType(ActionSuite, ['id', 'name']) {
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

  constructor(suite: ActionSuite, actions?: Action[]) {
    super();
    this.id = suite.id;
    this.name = suite.name;
    this.actions =
      actions?.map((action) => new ActionDto(action)) ??
      suite.actions?.map((action) => new ActionDto(action)) ??
      [];
    // Suite events are stored as per-action duplicate rows tagged suiteManaged;
    // we surface actions[0]'s copies as canonical. Brittle if actions drift —
    // any divergence (extra/missing rows, reordering) is invisible here.
    this.events = suite.actions?.length
      ? (suite.actions[0].events
          ?.filter((event) => event.suiteManaged)
          .map((event) => new ActionEventDto(event)) ?? [])
      : [];
    this.reminderGroups =
      suite.reminderGroups?.map((group) => new ReminderGroupDto(group)) ?? [];
    this.generalUpdates =
      suite.generalUpdates?.map((update) => new GeneralUpdateDto(update)) ?? [];
  }
}

export class ExportActionDto extends OmitType(Action, [
  'deadlineWeekNumber',
  'memberActionPhase',
  'status',
  'usersJoined',
  'usersCompleted',
  'formVariants',
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

export class ActionSummaryDto extends PickType(Action, ['id', 'name']) {
  constructor(action: Pick<Action, 'id' | 'name'>) {
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
  ActivityGroup = 'activity_group',
  ActionUpdate = 'action_update',
  NewMembers = 'new_members',
  ForumComments = 'forum_comments',
}

export const GlobalFeedActivityTypes = [
  ActionActivityType.USER_COMPLETED,
  ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM,
] as const satisfies ActionActivityType[];
export type GlobalFeedActivityType = (typeof GlobalFeedActivityTypes)[number];

export class GlobalFeedActivityGroupDto {
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty({
    enum: GlobalFeedActivityTypes,
    enumName: 'GlobalFeedActivityTypes',
  })
  activityType: GlobalFeedActivityType;

  @ApiProperty()
  count: number;
}

export class GlobalFeedActionUpdateDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: () => EditableContentDto })
  @Type(() => EditableContentDto)
  content: EditableContentDto;

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
  @ApiProperty({ enum: GlobalFeedItemType, enumName: 'GlobalFeedItemType' })
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
  ActionUpdate = 'action_update',
  ActionEvent = 'action_event',
}

export type TimelineFeedItem = {
  date: Date;
  action: Action;
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
  @ApiProperty({ enum: TimelineFeedItemType, enumName: 'TimelineFeedItemType' })
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
  Activity = 'activity',
  ForumComment = 'forum_comment',
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

  constructor(input: {
    comment: Comment;
    postId: number;
    postTitle: string;
    likedByMe: boolean;
    likesCount: number;
  }) {
    this.comment = new CommentDto(input.comment);
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
      forumComment: {
        comment: Comment;
        postId: number;
        postTitle: string;
        likedByMe: boolean;
        likesCount: number;
      };
    }
);

export class HomeFeedItemDto {
  @ApiProperty({ enum: HomeFeedItemType, enumName: 'HomeFeedItemType' })
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
  // eslint-disable-next-line @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator
  @ApiProperty({ description: 'Cohort expression to evaluate' })
  @IsDefined()
  expression: CohortExpression;
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

export class ActionWithdrawalDto extends PickType(ActionActivity, [
  'userId',
  'declineReason',
  'isMoral',
  'outOfTime',
]) {
  constructor(activity: ActionActivity) {
    super();
    this.userId = activity.userId;
    this.declineReason = activity.declineReason;
    this.isMoral = activity.isMoral;
    this.outOfTime = activity.outOfTime;
  }
}
