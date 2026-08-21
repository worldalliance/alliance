import type { ContractField } from "@alliance/common/forms/form-schema";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { Contract } from "../entities/contract.entity";

export class ContractDto extends PickType(Contract, ["id", "markdown"]) {
  constructor(contract: Contract) {
    super();
    this.id = contract.id;
    this.markdown = contract.markdown;
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
  constructor(contract: Contract) {
    super();
    this.id = contract.id;
    this.name = contract.name;
    this.createdAt = contract.createdAt;
    this.markdown = contract.markdown;
    this.startDate = contract.startDate;
    this.endDate = contract.endDate;
  }
}

export class CreateContractDto extends PickType(Contract, [
  "name",
  "markdown",
  "startDate",
  "endDate",
]) {}

export class UpdateContractDto extends PickType(Contract, [
  "name",
  "startDate",
  "endDate",
]) {}

export type ContractFieldDto = ContractField & {
  contract: ContractDto;
};
