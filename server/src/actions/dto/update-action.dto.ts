import { PartialType } from '@nestjs/mapped-types';
import { ActionDto } from './create-action.dto';

export class UpdateActionDto extends PartialType(ActionDto) {}
