import { ApiProperty } from '@nestjs/swagger';

export class CreatePartialProfileDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  clientSecret: string;
}
