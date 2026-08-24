import type { ContractField } from "@alliance/common/forms/form-schema";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Contract, type ParsedContract } from "../entities/contract.entity";

export class ContractDescriptionItem {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  point: string;

  @ApiProperty()
  @IsString()
  subtext: string;
}

export class ContractDto extends PickType(Contract, ["id", "markdown"]) {
  @ApiProperty({ type: () => ContractDescriptionItem, isArray: true })
  description: ContractDescriptionItem[];

  constructor(input: ParsedContract) {
    super();
    this.id = input.id;
    this.markdown = input.markdown;
    this.description = input.description;
  }
}

export class SignContractDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signedName: string;
}

export class ContractEventDateDto {
  @ApiProperty()
  date: Date;

  constructor(date: Date) {
    this.date = date;
  }
}

export class ContractAdminDto extends PickType(Contract, [
  "id",
  "name",
  "createdAt",
  "markdown",
  "startDate",
  "endDate",
]) {
  @ApiProperty({ type: () => ContractDescriptionItem, isArray: true })
  description: ContractDescriptionItem[];

  constructor(input: ParsedContract) {
    super();
    this.id = input.id;
    this.name = input.name;
    this.createdAt = input.createdAt;
    this.markdown = input.markdown;
    this.startDate = input.startDate;
    this.endDate = input.endDate;
    this.description = input.description;
  }
}

export class CreateContractDto extends PickType(Contract, [
  "name",
  "markdown",
  "startDate",
  "endDate",
]) {
  @ApiPropertyOptional({ type: () => ContractDescriptionItem, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractDescriptionItem)
  description?: ContractDescriptionItem[];
}

export class UpdateContractDto extends PickType(Contract, [
  "name",
  "startDate",
  "endDate",
]) {
  @ApiPropertyOptional({ type: () => ContractDescriptionItem, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractDescriptionItem)
  description?: ContractDescriptionItem[];
}

export type ContractFieldDto = ContractField & {
  contract: ContractDto;
};
