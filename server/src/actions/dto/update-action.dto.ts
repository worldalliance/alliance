import { PartialType } from '@nestjs/mapped-types';
import { CreateActionDto } from './create-action.dto';

export class UpdateActionDto extends PartialType(CreateActionDto) {}
