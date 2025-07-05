import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Action } from '../entities/action.entity';
import { UserAction } from '../entities/user-action.entity';
import { ActionEvent, ActionStatus } from '../entities/action-event.entity';
import { ActionActivity } from '../entities/action-activity.entity';
import { User } from '../../user/user.entity';

export class UserActionDto extends PickType(UserAction, [
  'status',
  'deadline',
  'dateCommitted',
  'dateCompleted',
]) {}

export class ActionEventDto extends PickType(ActionEvent, [
  'id',
  'title',
  'description',
  'newStatus',
  'showInTimeline',
  'sendNotifsTo',
  'date',
]) {
  constructor(partial: Partial<ActionEventDto>) {
    super();
    Object.assign(this, partial);
  }
}

export class CreateActionEventDto extends OmitType(ActionEventDto, ['id']) {}

export class ActionDto extends OmitType(Action, [
  'createdAt',
  'updatedAt',
  'userRelations',
  'events',
]) {
  @ApiProperty({ type: UserActionDto })
  myRelation?: Omit<UserActionDto, 'action'> | null;

  @ApiProperty()
  usersJoined: number;

  @ApiProperty()
  usersCompleted: number;

  @ApiProperty({ type: [ActionEventDto] })
  events: ActionEventDto[];

  @ApiProperty({ enum: ActionStatus, enumName: 'ActionStatus' })
  status: ActionStatus;

  constructor(action: Partial<Action>) {
    super();
    Object.assign(this, action);
    this.myRelation = null;
    this.usersJoined = action.usersJoined || 0;
    this.usersCompleted = action.usersCompleted || 0;
    this.status = action.status || ActionStatus.Draft;
    this.events =
      action.events?.map((event) => new ActionEventDto({ ...event })) || [];
  }
}

export class PublicActionDto extends OmitType(ActionDto, ['myRelation']) {}

export class CreateActionDto extends OmitType(ActionDto, [
  'id',
  'usersJoined',
  'myRelation',
  'events',
  'usersCompleted',
  'status',
]) {}

export class ActionWithRelationDto extends PublicActionDto {
  @ApiProperty({ type: UserActionDto })
  relation?: Omit<UserActionDto, 'action'> | null;
}

export class UpdateActionDto extends PartialType(CreateActionDto) {}

export class LatLonDto {
  @ApiProperty({ type: Number })
  latitude: number;

  @ApiProperty({ type: Number })
  longitude: number;
}

export class ActionActivityDto extends PickType(ActionActivity, [
  'id',
  'type',
  'createdAt',
]) {
  @ApiProperty({ type: () => User })
  user: Pick<User, 'id' | 'name' | 'email'>;
}
