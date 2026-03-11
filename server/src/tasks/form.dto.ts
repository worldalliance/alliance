// src/forms/dto/create-form.dto.ts
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsEnum, IsOptional, IsString } from 'class-validator';
import { AiDetectionResultDto } from 'src/ai-detection/dto/ai-detection-result.dto';
import { ActionDto } from 'src/actions/dto/action.dto';
import { UserDto } from 'src/user/dto/user.dto';
import { Form } from './entities/form.entity';
import { FormResponse } from './entities/formresponse.entity';
import type { Ty } from './entities/type';
import type { DeviceVisibilityTarget } from './schema';
import { DEVICE_VISIBILITY_TARGETS } from './schema';

export class CreateFormDto extends PickType(Form, ['title', 'schema']) {}

export class SubmitFormDto extends PickType(FormResponse, [
  'answers',
  'schemaSnapshot',
  'phDistinctId',
  'sessionReplayUrl',
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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  sid?: string;
}

export class SubmitFollowUpFormDto extends OmitType(SubmitFormDto, [
  'actionId',
]) {}

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
  'phDistinctId',
  'sessionReplayUrl',
  'deviceType',
  'sid',
  'publicAnswers',
]) {
  @ApiPropertyOptional({ type: () => UserDto })
  @IsOptional()
  @Type(() => UserDto)
  user?: UserDto;

  @ApiPropertyOptional({ type: () => AiDetectionResultDto, isArray: true })
  @IsOptional()
  @Type(() => AiDetectionResultDto)
  aiDetectionResults?: AiDetectionResultDto[];
}
