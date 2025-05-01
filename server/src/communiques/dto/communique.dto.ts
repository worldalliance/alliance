import { OmitType, PartialType } from '@nestjs/swagger';
import { Communique } from '../entities/communique.entity';

export class CommuniqueDto extends OmitType(Communique, ['dateUpdated']) {}

export class CreateCommuniqueDto extends OmitType(CommuniqueDto, ['id']) {}

export class UpdateCommuniqueDto extends PartialType(CreateCommuniqueDto) {}
