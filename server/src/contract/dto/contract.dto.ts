import type { ContractField } from "@alliance/common/forms/form-schema";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
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

export class ContractAdminDescriptionItem extends ContractDescriptionItem {
  @ApiProperty({ description: "Shown only in the admin panel" })
  @IsString()
  adminNotes: string;
}

export class ContractDto extends PickType(Contract, ["id", "markdown"]) {
  @ApiProperty({ type: () => ContractDescriptionItem, isArray: true })
  description: ContractDescriptionItem[];

  constructor(input: ParsedContract) {
    super();
    this.id = input.id;
    this.markdown = input.markdown;
    this.description = input.description.map(({ point, subtext }) => ({
      point,
      subtext,
    }));
  }
}

export class SignContractDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
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
  @ApiProperty({ type: () => ContractAdminDescriptionItem, isArray: true })
  description: ContractAdminDescriptionItem[];

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
  @ApiPropertyOptional({
    type: () => ContractAdminDescriptionItem,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractAdminDescriptionItem)
  description?: ContractAdminDescriptionItem[];
}

export class UpdateContractDto extends PickType(Contract, [
  "name",
  "startDate",
  "endDate",
]) {
  @ApiPropertyOptional({
    type: () => ContractAdminDescriptionItem,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractAdminDescriptionItem)
  description?: ContractAdminDescriptionItem[];
}

export type ContractFieldDto = ContractField & {
  contract: ContractDto;
};
