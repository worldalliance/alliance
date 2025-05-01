import { OmitType, PartialType } from '@nestjs/swagger';
import { Action } from '../entities/action.entity';

export class ActionDto extends OmitType(Action, ['createdAt', 'updatedAt']) {}

export class CreateActionDto extends OmitType(ActionDto, [
  'id',
  'usersJoined',
]) {}

export class UpdateActionDto extends PartialType(CreateActionDto) {}
