import {
  ApiPropertyOptional,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { FollowUpForm } from '../entities/follow-up-form.entity';
import { Form } from 'src/tasks/entities/form.entity';

export class FollowUpFormDto extends OmitType(FollowUpForm, [
  'action',
  'form',
]) {
  @ApiPropertyOptional({ type: () => Form })
  @IsOptional()
  @Type(() => Form)
  form?: Form;
}

export class CreateFollowUpFormDto extends PickType(FollowUpForm, [
  'actionId',
  'formId',
  'startDate',
  'endDate',
  'name',
  'instructions',
]) {}

export class UpdateFollowUpFormDto extends PartialType(
  PickType(FollowUpForm, [
    'name',
    'startDate',
    'endDate',
    'formId',
    'instructions',
  ]),
) {}
