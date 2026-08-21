import { ApiProperty } from "@nestjs/swagger";

export class PaymentMethodDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  brand: string;

  @ApiProperty()
  last4: string;

  @ApiProperty()
  exp_month: number;

  @ApiProperty()
  exp_year: number;
}
