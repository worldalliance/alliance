import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Action } from '../entities/action.entity';
import { UserAction } from '../entities/user-action.entity';

export class UserActionDto extends PickType(UserAction, [
  'status',
  'deadline',
  'dateCommitted',
]) {}

export class ActionDto extends OmitType(Action, [
  'createdAt',
  'updatedAt',
  'userRelations',
]) {
  @ApiProperty({ type: UserActionDto })
  myRelation: UserActionDto | null;

  @ApiProperty()
  usersJoined: number;
}

export class PublicActionDto extends OmitType(ActionDto, ['myRelation']) {}

export class CreateActionDto extends OmitType(ActionDto, [
  'id',
  'usersJoined',
  'myRelation',
]) {}

export class UpdateActionDto extends PartialType(CreateActionDto) {}
