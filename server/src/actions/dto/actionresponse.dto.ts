import { ApiProperty } from '@nestjs/swagger';

export class AllActionsDto {
  @ApiProperty()
  actions: { name: string; status: string }[];
}
