import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsEnum, IsOptional, IsString } from 'class-validator';
import { type TokenMode } from './signin.dto';

export class CreateGuestSessionDto {
  @ApiProperty({ enum: ['cookie', 'header'] })
  @IsDefined()
  @IsEnum(['cookie', 'header'])
  mode: TokenMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestToken?: string;
}

export class GuestSessionResponseDto {
  @ApiProperty()
  guestId: string;

  @ApiPropertyOptional()
  guestToken?: string;
}
