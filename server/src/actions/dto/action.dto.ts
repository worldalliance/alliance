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
  IsBoolean,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CommentDto } from 'src/forum/dto/comment.dto';
import {
  CreateEditableContentDto,
  EditableContentDto,
} from 'src/forum/dto/editablecontent.dto';
import { ProfileDto, UserDto } from 'src/user/user.dto';
import { UserActionRelation } from '../actions.service';
import { ActionActivity } from '../entities/action-activity.entity';
import {
  ActionEvent,
  ActionStatus,
  NotificationType,
} from '../entities/action-event.entity';
import { ActionReminder } from '../entities/action-reminder.entity';
import { Action } from '../entities/action.entity';
import { getImageSource } from 'src/images/images.service';
import { ActionUpdate } from '../entities/action-update.entity';

export class ActionReminderDto extends PickType(ActionReminder, [
  'id',
  'emailMessage',
  'textMessage',
  'cohortType',
  'timingMode',
  'sendAtAbsolute',
  'sendAtSecondsFromDeadline',
  'sentAt',
]) {
  @ApiProperty()
  id: number;

  @ApiProperty()
  memberActionEventId: number;

  @ApiPropertyOptional()
  deadlineEventId?: number;

  @ApiProperty({ type: Number, isArray: true })
  userIds: number[];

  @ApiProperty({ type: ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiPropertyOptional()
  customEmailSubject?: string;

  constructor(reminder: ActionReminder) {
    super();
    Object.assign(this, reminder);
    this.userIds = reminder.users?.map((user) => user.id) ?? [];
    this.memberActionEventId = reminder.memberActionEvent?.id ?? 0;
    this.users = reminder.users?.map((user) => new ProfileDto(user)) ?? [];
  }
}

export class CreateActionReminderDto extends PickType(ActionReminder, [
  'cohortType',
  'timingMode',
  'sendAtAbsolute',
  'sendAtSecondsFromDeadline',
  'emailMessage',
  'emailSubject',
  'textMessage',
]) {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deadlineEventId?: number;

  @ApiPropertyOptional({ type: Number, isArray: true })
  @Type(() => Number)
  @IsOptional()
  userIds?: number[];
}

export class UpdateActionReminderDto extends PartialType(
  CreateActionReminderDto,
) {}

export class ActionEventDto extends PickType(ActionEvent, [
  'id',
  'title',
  'description',
  'newStatus',
  'showInTimeline',
  'sendNotifsTo',
  'date',
  'announcementNotifsSentAt',
]) {
  constructor(event: ActionEvent) {
    super();
    Object.assign(this, event);
  }
}

export class AdminActionEventDto extends PickType(ActionEvent, [
  'id',
  'title',
  'description',
  'newStatus',
  'showInTimeline',
  'sendNotifsTo',
  'date',
  'announcementNotifsSentAt',
  'reminders',
  'deadlineNotifsSentAt',
  'updatedAt',
  'notifications',
]) {
  constructor(event: ActionEvent) {
    super();
    Object.assign(this, event);
  }
}

export class CreateActionEventDto extends OmitType(ActionEventDto, [
  'id',
  'announcementNotifsSentAt',
]) {}

export class ActionDto extends OmitType(Action, [
  'createdAt',
  'updatedAt',
  'events',
]) {
  @ApiProperty()
  usersJoined: number;

  @ApiProperty()
  usersCompleted: number;

  @ApiProperty({ type: ActionEventDto, isArray: true })
  events: ActionEventDto[];

  @ApiProperty({ enum: ActionStatus, enumName: 'ActionStatus' })
  status: ActionStatus;

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

  constructor(
    action: Partial<Action>,
    extra?: {
      canParticipate?: boolean;
      shouldParticipate?: boolean;
      userJoined?: number;
      userRelation?: UserActionRelation;
      reqAuthenticated?: boolean;
    },
  ) {
    super();
    Object.assign(this, action);
    this.image = action.image ? getImageSource(action.image) : undefined;
    this.usersJoined = extra?.userJoined || action.usersJoined || 0;
    this.usersCompleted = action.usersCompleted || 0;
    this.status = action.status || ActionStatus.Draft;
    this.events =
      action.events?.map((event) => new ActionEventDto(event)) || [];
    this.canParticipate = extra?.canParticipate;
    this.shouldParticipate = extra?.shouldParticipate;
    this.userRelation = extra?.userRelation;
    this.reqAuthenticated = extra?.reqAuthenticated;
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
  'archived',
  'updates',
]) {}

export class UpdateActionDto extends PartialType(CreateActionDto) {}

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
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsBoolean()
  outOfTime: boolean;
}

export class ActionActivityDto extends PickType(ActionActivity, [
  'id',
  'type',
  'createdAt',
]) {
  @ApiProperty({ type: () => ProfileDto })
  @Type(() => ProfileDto)
  @Allow()
  user: ProfileDto;

  @ApiProperty()
  @Allow()
  actionId: number;

  @ApiProperty({ type: () => ActionDto })
  @Type(() => ActionDto)
  @Allow()
  action: ActionDto;

  @ApiProperty()
  @Allow()
  actionName: string;

  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  @Allow()
  likes: ProfileDto[];

  @ApiProperty({ type: () => CommentDto, isArray: true })
  @Type(() => CommentDto)
  @Allow()
  comments: CommentDto[];

  @ApiProperty({ type: () => EditableContentDto })
  @Type(() => EditableContentDto)
  @Allow()
  editableContent: EditableContentDto;

  constructor(actionActivity: ActionActivity, comments: CommentDto[] = []) {
    super();
    Object.assign(this, actionActivity);
    this.actionId = actionActivity.action.id;
    this.action = new ActionDto(actionActivity.action);
    this.actionName = actionActivity.action.name;
    this.user = new ProfileDto(actionActivity.user);
    this.likes =
      actionActivity.likes !== undefined
        ? actionActivity.likes.map((like) => new ProfileDto(like))
        : [];
    this.comments = comments;
    if (!this.editableContent) {
      this.editableContent = {
        body: '',
        attachments: [],
      };
    }
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

export class PreEventNotifDataDto {
  @ApiProperty({ type: () => UserDto, isArray: true })
  emails: UserDto[];

  @ApiProperty({ type: () => UserDto, isArray: true })
  texts: UserDto[];

  @ApiProperty({ type: () => UserDto, isArray: true })
  pushes: UserDto[];
}

export class PreEventNotifDataQueryDto {
  @ApiProperty({ enum: ActionStatus, enumName: 'ActionStatus' })
  @Allow()
  type: ActionStatus;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  @Allow()
  sendNotifsTo: NotificationType;
}

export class CreateActionUpdateDto extends PickType(ActionUpdate, [
  'title',
  'displayDate',
  'visibleAt',
  'notifyType',
]) {
  @ApiProperty({ type: () => CreateEditableContentDto })
  @Type(() => CreateEditableContentDto)
  @IsDefined()
  content: CreateEditableContentDto;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  associatedEventId?: number;
}
