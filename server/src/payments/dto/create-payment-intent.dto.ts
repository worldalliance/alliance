import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class CreatePaymentIntentDto {
  @ApiProperty()
  @IsNotEmpty()
  actionId: number;
}
