import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Action } from '../entities/action.entity';
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
  'sendNotifsTo',
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
  'events',
]) {
  @ApiProperty({ type: UserActionDto })
  myRelation?: Omit<UserActionDto, 'action'> | null;

  @ApiProperty()
  usersJoined: number;

  @ApiProperty({ type: [ActionEventDto] })
  events: ActionEventDto[];

  constructor(action: Partial<Action>) {
    super();
    this.myRelation = null;
    this.usersJoined =
      action.userRelations?.filter(
        (ur) => ur.status === UserActionRelation.joined,
      ).length || 0;
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
