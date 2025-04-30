import { ApiProperty } from '@nestjs/swagger';

export class CreateCommuniqueDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  image: string;
}
