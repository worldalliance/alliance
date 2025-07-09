import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Action } from '../entities/action.entity';
import { UserAction } from '../entities/user-action.entity';
import { ActionEvent, ActionStatus } from '../entities/action-event.entity';
import { ActionActivity } from '../entities/action-activity.entity';
import { ProfileDto } from 'src/user/user.dto';

export class UserActionDto extends PickType(UserAction, [
  'status',
  'deadline',
  'dateCommitted',
  'dateCompleted',
]) {
  @ApiProperty({ type: Number })
  actionId: number;

  constructor(userAction: UserAction) {
    super();
    Object.assign(this, userAction);
    this.actionId = userAction.action.id;
  }
}

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
    this.usersJoined = action.usersJoined || 0;
    this.usersCompleted = action.usersCompleted || 0;
    this.status = action.status || ActionStatus.Draft;
    this.events =
      action.events?.map((event) => new ActionEventDto({ ...event })) || [];
  }
}

export class CreateActionDto extends OmitType(ActionDto, [
  'id',
  'usersJoined',
  'events',
  'usersCompleted',
  'status',
]) {}

export class ActionWithRelationDto extends ActionDto {
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
  @ApiProperty({ type: () => ProfileDto })
  user: ProfileDto;
}
