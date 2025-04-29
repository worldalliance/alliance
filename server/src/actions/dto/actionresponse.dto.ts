import { ApiProperty } from '@nestjs/swagger';
import { ActionDto } from './create-action.dto';

export class AllActionsDto {
  @ApiProperty()
  actions: ActionDto[];
}
