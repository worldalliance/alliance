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
import { ProfileDto } from 'src/user/dto/user.dto';
import {
  ActionActivity,
  ActionActivityType,
} from '../entities/action-activity.entity';
import { ActionEvent, ActionStatus } from '../entities/action-event.entity';
import { Action } from '../entities/action.entity';
import { getImageSource } from 'src/images/images.service';
import { ActionUpdate } from '../entities/action-update.entity';
import {
  ReminderGroup,
  ReminderCohortType,
} from '../entities/reminder-group.entity';
import { ActionSuite } from '../entities/action-suite.entity';
import { Form } from 'src/tasks/entities/form.entity';
import { SubmitFormDto } from 'src/tasks/form.dto';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { PreviewNotificationPlan } from 'src/notifs/action-event-reminder.service';
import { GeneralUpdate } from '../entities/general-update.entity';
import type { CohortExpression } from '../cohort-expression.types';

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

export class PreviewTextMessageResponse {
  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  text: string;
}

export class PreviewEmailHtmlResponse {
  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  subject: string;

  @ApiProperty({ type: String })
  @IsDefined()
  @IsString()
  html: string;
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
    Object.assign(this, event);
  }
}

export class CreateActionEventDto extends OmitType(ActionEventDto, [
  'id',
  'suiteManaged',
]) {}

export class UpdateActionEventDto extends PartialType(CreateActionEventDto) {}

export enum UserActionRelation {
  Joined = 'joined',
  Completed = 'completed',
  None = 'none',
  Declined = 'declined',
  Dismissed = 'dismissed',
}

export class ActionDto extends OmitType(Action, [
  'authors',
  'events',
  'updates',
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

  @ApiPropertyOptional()
  reqAuthenticated?: boolean;

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  authors?: ProfileDto[];

  constructor(
    action: Partial<Action>,
    extra?: {
      canParticipate?: boolean;
      shouldParticipate?: boolean;
      userRelation?: UserActionRelation;
      reqAuthenticated?: boolean;
    },
  ) {
    super();
    Object.assign(this, action);
    this.image = action.image ? getImageSource(action.image) : undefined;
    this.squareThumbnailImage = action.squareThumbnailImage
      ? getImageSource(action.squareThumbnailImage)
      : undefined;
    this.squareThumbnailImageAlt =
      action.squareThumbnailImageAlt ?? action.name;
    this.usersCompleted = action.usersCompleted || 0;
    this.status = (action.events && action.status) ?? ActionStatus.Draft;
    this.events =
      action.events?.map((event) => new ActionEventDto(event)) || [];
    this.canParticipate = extra?.canParticipate;
    this.shouldParticipate = extra?.shouldParticipate;
    this.userRelation = extra?.userRelation;
    this.reqAuthenticated = extra?.reqAuthenticated;
    this.authors =
      action.authors?.map((author) => new ProfileDto(author)) || [];
  }
}

export class CreateActionDto extends OmitType(ActionDto, [
  'id',
  'usersJoined',
  'events',
  'activities',
  'usersCompleted',
  'status',
  'taskContents',
  'events',
  'suite',
  'archived',
  'updates',
  'authors',
  'createdAt',
  'updatedAt',
  'deadlineWeekNumber',
  'priority',
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

export class DeclineActionDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsBoolean()
  moral: boolean;
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

  @ApiPropertyOptional({ type: Object })
  @Type(() => Object)
  @IsOptional()
  partialFormData?: SubmitFormDto;
}

export class FormResponseOutputDto extends PickType(FormResponse, [
  'id',
  'answers',
  'formId',
  'schemaSnapshot',
  'visibilityValidatorResults',
  'deviceType',
  'publicAnswers',
]) {
  constructor(formResponse: FormResponse) {
    super();
    Object.assign(this, formResponse);
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
      comments?: CommentDto[];
      formResponseOutput?: FormResponseOutputDto;
      includeLikes?: boolean;
      likedByMe?: boolean;
    },
  ) {
    super();
    this.actionName = actionActivity.action?.name;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, ...rest } = actionActivity;
    Object.assign(this, rest);
    this.user = new ProfileDto(actionActivity.user);
    // Only include likes array when explicitly requested (detail views, like/unlike)
    // For feed views, we rely on likesCount which is already set via Object.assign
    if (extra?.includeLikes && actionActivity.likes !== undefined) {
      this.likes = actionActivity.likes.map((like) => new ProfileDto(like));
    }
    this.likedByMe = extra?.likedByMe;
    this.comments = extra?.comments ?? [];
    this.formResponseOutput = extra?.formResponseOutput;
    this.editableContent = actionActivity.editableContent
      ? new EditableContentDto(actionActivity.editableContent)
      : { body: '', attachments: [], id: -1 };
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
    Object.assign(this, actionUpdate);
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

export class ActionSuiteDto extends OmitType(ActionSuite, ['actions']) {
  @ApiProperty({ type: () => ActionDto, isArray: true })
  @Type(() => ActionDto)
  @Allow()
  actions: ActionDto[];

  constructor(suite: ActionSuite, actions?: ActionDto[]) {
    super();
    Object.assign(this, suite);
    this.actions =
      actions || suite.actions.map((action) => new ActionDto(action));
  }
}

export class ExportActionDto extends OmitType(Action, [
  'deadlineWeekNumber',
  'latestMemberActionEvent',
  'status',
  'usersJoined',
  'usersCompleted',
]) {
  @ApiPropertyOptional({ type: () => Form })
  @Type(() => Form)
  @IsOptional()
  taskForm?: Form;

  @ApiPropertyOptional({ type: () => ReminderGroup, isArray: true })
  @Type(() => ReminderGroup)
  @IsOptional()
  reminderGroups?: ReminderGroup[];
}

export class PasteJsonDto {
  @ApiProperty()
  @IsString()
  body: string;
}

export class SuspensionPlanDto {
  @ApiProperty({ type: Date })
  @IsDefined()
  @Type(() => Date)
  date: Date;

  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  @IsDefined()
  users: ProfileDto[];
}

export class ActionSummaryDto extends PickType(Action, ['id', 'name']) {
  constructor(action: Pick<Action, 'id' | 'name'>) {
    super();
    this.id = action.id;
    this.name = action.name;
  }
}

export class ForumAutocompletePlanDto extends SuspensionPlanDto {
  @ApiProperty({ type: () => ActionSummaryDto })
  @Type(() => ActionSummaryDto)
  @IsDefined()
  action: ActionSummaryDto;
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
}

export class ReminderGroupPlanDto {
  @ApiProperty({ type: () => ReminderGroup })
  @Type(() => ReminderGroup)
  @IsDefined()
  reminderGroup: ReminderGroup;

  @ApiProperty({ type: () => PreviewNotificationPlan, isArray: true })
  @Type(() => PreviewNotificationPlan)
  @IsDefined()
  willNotify: PreviewNotificationPlan[];
}

export enum GlobalFeedItemType {
  ActivityGroup = 'activity_group',
  ActionUpdate = 'action_update',
  NewMembers = 'new_members',
  ForumComments = 'forum_comments',
}

export const GlobalFeedActivityTypes = [
  ActionActivityType.USER_JOINED,
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
}

export enum TimelineFeedItemType {
  ActionUpdate = 'action_update',
  ActionEvent = 'action_event',
}

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
}
