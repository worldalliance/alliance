import { PartialType } from '@nestjs/swagger';
import { CreateCommuniqueDto } from './create-communique.dto';

export class UpdateCommuniqueDto extends PartialType(CreateCommuniqueDto) {}
