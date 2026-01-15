import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';
import {
  CustomValidator,
  CustomValidatorType,
} from './entities/customvalidator.entity';

export class CustomValidatorTypeDto {
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: CustomValidatorType, enumName: 'CustomValidatorType' })
  @IsNotEmpty()
  id: CustomValidatorType;

  @ApiProperty()
  @IsNotEmpty()
  withIdField: boolean;

  @ApiProperty()
  @IsNotEmpty()
  usableForVisibility: boolean;
}

export class CreateCustomValidatorDto {
  @ApiProperty({ enum: CustomValidatorType, enumName: 'CustomValidatorType' })
  @IsNotEmpty()
  type: CustomValidatorType;

  @ApiPropertyOptional()
  @IsOptional()
  idArgument?: string;
}

export class CustomValidatorDto extends CustomValidator {}

export class CreateCustomValidatorResponseDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;
}

export class CustomValidatorResponseDto {
  @ApiProperty()
  @IsNotEmpty()
  isValid: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  message?: string;
}

export class RunValidatorDto {
  @ApiPropertyOptional()
  @IsOptional()
  fieldValue?: string;
}
