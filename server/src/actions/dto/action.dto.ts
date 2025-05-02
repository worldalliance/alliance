import { OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Action } from '../entities/action.entity';
import { UserAction } from '../entities/user-action.entity';

export class ActionDto extends OmitType(Action, ['createdAt', 'updatedAt']) {}

export class CreateActionDto extends OmitType(ActionDto, [
  'id',
  'usersJoined',
]) {}

export class UpdateActionDto extends PartialType(CreateActionDto) {}

export class UserActionDto extends PickType(UserAction, ['status']) {}
