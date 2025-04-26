import { IsString } from 'class-validator';
import { IsNotEmpty } from 'class-validator';

export class CreateActionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  whyJoin: string;

  @IsString()
  type: string;

  @IsString()
  description: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}
