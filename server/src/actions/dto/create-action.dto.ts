import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { ActionStatus } from '../entities/action.entity';

export class CreateActionDto {
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsNotEmpty()
  @ApiProperty()
  category: string;

  @ApiProperty()
  whyJoin: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  description: string;

  @IsNotEmpty()
  @ApiProperty({ enum: Object.keys(ActionStatus) })
  status: ActionStatus;
}
