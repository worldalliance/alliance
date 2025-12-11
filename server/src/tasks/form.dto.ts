// src/forms/dto/create-form.dto.ts
import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsEnum, IsOptional } from 'class-validator';
import { ActionDto } from 'src/actions/dto/action.dto';
import { UserDto } from 'src/user/user.dto';
import { Form } from './entities/form.entity';
import { FormResponse } from './entities/formresponse.entity';
import { Ty } from './entities/type';
import type { DeviceVisibilityTarget } from './schema';
import { DEVICE_VISIBILITY_TARGETS } from './schema';

export class CreateFormDto extends PickType(Form, ['title', 'schema']) {}

export class SubmitFormDto extends PickType(FormResponse, [
  'answers',
  'schemaSnapshot',
]) {
  @ApiProperty()
  @IsDefined()
  actionId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Object)
  visibilityValidatorResults?: Record<number, boolean>;

  @ApiPropertyOptional({ enum: DEVICE_VISIBILITY_TARGETS })
  @IsEnum(DEVICE_VISIBILITY_TARGETS)
  @IsOptional()
  deviceType?: DeviceVisibilityTarget;

  @ApiPropertyOptional({ type: Object })
  @Type(() => Object)
  @IsOptional()
  publicAnswers?: Record<string, boolean>;
}

export class FormDto extends PickType(Form, ['id', 'title', 'schema']) {
  @ApiPropertyOptional({ type: () => ActionDto })
  usedInAction?: Ty<ActionDto>;
}

export class FormResponseDto extends PickType(FormResponse, [
  'id',
  'answers',
  'formId',
  'createdAt',
  'schemaSnapshot',
  'visibilityValidatorResults',
  'deviceType',
  'publicAnswers',
]) {
  @ApiPropertyOptional({ type: () => UserDto })
  @IsOptional()
  @Type(() => UserDto)
  user?: UserDto;
}
