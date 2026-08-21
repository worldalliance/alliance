import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ClientSecretDto {
  @ApiProperty()
  clientSecret: string;

  @ApiPropertyOptional()
  userToken?: string;

  @ApiPropertyOptional()
  savedPaymentMethodId?: string;

  @ApiPropertyOptional()
  savedPaymentMethodLast4?: string;

  @ApiPropertyOptional()
  amount?: number;
}
