import { ApiProperty } from "@nestjs/swagger";
import { IsDefined, IsNumber } from "class-validator";

export class PushOpenedDto {
  @ApiProperty()
  @IsDefined()
  @IsNumber()
  cid: number;
}
