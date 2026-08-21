import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, ValidateIf } from "class-validator";
import { User } from "src/user/entities/user.entity";
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
  @IsNotEmpty()
  type: CustomValidatorType;

  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  idArgument: string | null;

  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  expression: string | null;
}

export class CustomValidatorDto extends PickType(CustomValidator, [
  "id",
  "type",
  "idArgument",
  "expression",
]) {
  constructor(input: CustomValidator) {
    super();
    this.id = input.id;
    this.type = input.type;
    this.idArgument = input.idArgument;
    this.expression = input.expression;
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

export class CustomExpressionUserDto extends PickType(User, [
  "id",
  "name",
  "anonymous",
]) {
  constructor(input: User) {
    super();
    this.id = input.id;
    this.name = input.name;
    this.anonymous = input.anonymous;
  }
}

export class TestCustomExpressionDto {
  @ApiProperty()
  @IsNotEmpty()
  expression: string;

  @ApiPropertyOptional()
  @IsOptional()
  userId?: number;
}

export type TestCustomExpressionResponse = {
  passCount: number;
  failCount: number;
  totalCount: number;
  passUsers: User[];
  failUsers: User[];
  selectedUserId?: number;
  selectedUserResult?: boolean;
};

export class TestCustomExpressionResponseDto {
  @ApiProperty()
  @IsNotEmpty()
  passCount: number;

  @ApiProperty()
  @IsNotEmpty()
  failCount: number;

  @ApiProperty()
  @IsNotEmpty()
  totalCount: number;

  @ApiProperty({ type: CustomExpressionUserDto, isArray: true })
  @Type(() => CustomExpressionUserDto)
  @IsNotEmpty()
  passUsers: CustomExpressionUserDto[];

  @ApiProperty({ type: CustomExpressionUserDto, isArray: true })
  @Type(() => CustomExpressionUserDto)
  @IsNotEmpty()
  failUsers: CustomExpressionUserDto[];

  @ApiPropertyOptional()
  @IsOptional()
  selectedUserId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  selectedUserResult?: boolean;

  constructor(input: TestCustomExpressionResponse) {
    this.passCount = input.passCount;
    this.failCount = input.failCount;
    this.totalCount = input.totalCount;
    this.passUsers = input.passUsers.map((u) => new CustomExpressionUserDto(u));
    this.failUsers = input.failUsers.map((u) => new CustomExpressionUserDto(u));
    this.selectedUserId = input.selectedUserId;
    this.selectedUserResult = input.selectedUserResult;
  }
}
