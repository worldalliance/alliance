import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Action, ActionStatus } from '../entities/action.entity';
import { UserAction, UserActionRelation } from '../entities/user-action.entity';
import { ActionEvent } from '../entities/action-event.entity';

export class UserActionDto extends PickType(UserAction, [
  'status',
  'deadline',
  'dateCommitted',
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
  'events',
]) {
  @ApiProperty({ type: UserActionDto })
  myRelation: UserActionDto | null;

  @ApiProperty()
  usersJoined: number;

  @ApiProperty({ type: [ActionEventDto] })
  events: ActionEventDto[];

  constructor(action: Partial<Action>) {
    super();
    this.myRelation = null; // doesn't make sense for events to have a myRelation
    this.usersJoined =
      action.userRelations?.filter(
        (ur) => ur.status === UserActionRelation.joined,
      ).length || 0;
    this.events =
      action.events?.map(
        (event) =>
          new ActionEventDto({
            message: event.message,
            newStatus: event.newStatus,
            sendNotifs: event.sendNotifs,
            updateDate: event.updateDate,
            showInTimeline: event.showInTimeline,
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

export class UpdateActionDto extends PartialType(CreateActionDto) {}