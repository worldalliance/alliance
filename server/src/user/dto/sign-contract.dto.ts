import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignContractDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signedName: string;
}
