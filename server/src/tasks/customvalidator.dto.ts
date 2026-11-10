import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";
import {
  CustomValidator,
  CustomValidatorType,
} from "./entities/customvalidator.entity";

export type CustomValidatorTypeDtoArgs = {
  name: string;
  id: CustomValidatorType;
  withIdField: boolean;
  usableForVisibility: boolean;
};

export class CustomValidatorTypeDto {
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: CustomValidatorType, enumName: "CustomValidatorType" })
  @IsNotEmpty()
  id: CustomValidatorType;

  @ApiProperty()
  @IsNotEmpty()
  withIdField: boolean;

  @ApiProperty()
  @IsNotEmpty()
  usableForVisibility: boolean;

  constructor(input: CustomValidatorTypeDtoArgs) {
    this.name = input.name;
    this.id = input.id;
    this.withIdField = input.withIdField;
    this.usableForVisibility = input.usableForVisibility;
  }
}

export class CreateCustomValidatorDto {
  @ApiProperty({ enum: CustomValidatorType, enumName: "CustomValidatorType" })
  @IsEnum(CustomValidatorType)
  type: CustomValidatorType;

  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  idArgument: string | null;
}

export class CustomValidatorDto extends PickType(CustomValidator, [
  "id",
  "type",
  "idArgument",
]) {
  constructor(input: CustomValidator) {
    super();
    this.id = input.id;
    this.type = input.type;
    this.idArgument = input.idArgument;
  }
}

export class CreateCustomValidatorResponseDto {
  @ApiProperty()
  @IsNotEmpty()
  id: number;

  constructor(id: number) {
    this.id = id;
  }
}

export type CustomValidatorResponse = {
  isValid: boolean;
  message?: string;
};

export class CustomValidatorResponseDto {
  @ApiProperty()
  @IsNotEmpty()
  isValid: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  message?: string;

  constructor(input: CustomValidatorResponse) {
    this.isValid = input.isValid;
    this.message = input.message;
  }
}

export class RunValidatorDto {
  @ApiPropertyOptional()
  @IsOptional()
  fieldValue?: string;
}
