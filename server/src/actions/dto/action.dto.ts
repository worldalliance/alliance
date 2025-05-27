import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Action, ActionStatus } from '../entities/action.entity';
import { UserAction, UserActionRelation } from '../entities/user-action.entity';
import { ActionEvent } from '../entities/action-event.entity';

export class UserActionDto extends PickType(UserAction, [
  'status',
  'deadline',
  'dateCommitted',
  'dateCompleted',
]) {}

export class ActionEventDto extends PickType(ActionEvent, [
  'message',
  'newStatus',
  'sendNotifs',
  'updateDate',
  'showInTimeline',
]) {
  constructor(partial: Partial<ActionEventDto>) {
    super();
    Object.assign(this, partial);
  }
}

export class ActionDto extends OmitType(Action, [
  'createdAt',
  'updatedAt',
  'userRelations',
  'updates',
]) {
  @ApiProperty({ type: UserActionDto })
  myRelation?: Omit<UserActionDto, 'action'> | null;

  @ApiProperty()
  usersJoined: number;

  @ApiProperty({ type: [ActionEventDto] })
  updates: ActionEventDto[];

  constructor(action: Action) {
    super();
    this.myRelation = null;
    this.usersJoined =
      action.userRelations?.filter(
        (ur) => ur.status === UserActionRelation.joined,
      ).length || 0;
    this.updates =
      action.updates?.map(
        (update) =>
          new ActionEventDto({
            message: update.message,
            newStatus: update.newStatus,
            sendNotifs: update.sendNotifs,
            updateDate: update.updateDate,
            showInTimeline: update.showInTimeline,
          }),
      ) || [];
  }
}

export class PublicActionDto extends OmitType(ActionDto, ['myRelation']) {}

export class CreateActionDto extends OmitType(ActionDto, [
  'id',
  'usersJoined',
  'myRelation',
]) {}

export class ActionWithRelationDto extends PublicActionDto {
  @ApiProperty({ type: UserActionDto })
  relation?: Omit<UserActionDto, 'action'> | null;
}

export class UpdateActionDto extends PartialType(CreateActionDto) {
  @ApiProperty({ type: String, description: 'Message describing the update' })
  message?: string;

  @ApiProperty({
    enum: ['active', 'upcoming', 'past', 'draft'],
    description: 'The new status of the action',
  })
  newStatus?: ActionStatus;

  @ApiProperty({
    enum: ['all', 'joined', 'none'],
    description: 'Who should receive notifications',
  })
  sendNotifs?: 'all' | 'joined' | 'none';

  @ApiProperty({ type: Date, description: 'Date of the update' })
  updateDate?: Date;

  @ApiProperty({
    type: Boolean,
    description: 'Whether the update should appear in the timeline',
  })
  showInTimeline?: boolean;
}
