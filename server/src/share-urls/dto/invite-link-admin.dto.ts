import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { PaginatedListDto, PaginationQueryDto } from "src/utils/pagination.dto";

export enum InviteLinkKind {
  Individual = "individual",
  MultiUse = "multi_use",
}

export enum InviteLinkSort {
  Newest = "newest",
  Oldest = "oldest",
  MostUsed = "most_used",
  LeastUsed = "least_used",
}

export class InviteLinkQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InviteLinkKind, enumName: "InviteLinkKind" })
  @IsOptional()
  @IsEnum(InviteLinkKind)
  kind?: InviteLinkKind;

  @ApiPropertyOptional({
    enum: InviteLinkSort,
    enumName: "InviteLinkSort",
    default: InviteLinkSort.Newest,
  })
  @IsOptional()
  @IsEnum(InviteLinkSort)
  sort: InviteLinkSort = InviteLinkSort.Newest;
}

export type InviteLinkAdmin = {
  id: string;
  kind: InviteLinkKind;
  label: string;
  url: string;
  createdAt: Date;
  accountsCreated: number;
  initialSigners: number;
  retainedSigners: number;
};

export class InviteLinkAdminDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: InviteLinkKind, enumName: "InviteLinkKind" })
  kind: InviteLinkKind;
  @ApiProperty() label: string;
  @ApiProperty() url: string;
  @ApiProperty({ type: Date }) createdAt: Date;
  @ApiProperty() accountsCreated: number;
  @ApiProperty() initialSigners: number;
  @ApiProperty() retainedSigners: number;

  constructor(input: InviteLinkAdmin) {
    this.id = input.id;
    this.kind = input.kind;
    this.label = input.label;
    this.url = input.url;
    this.createdAt = input.createdAt;
    this.accountsCreated = input.accountsCreated;
    this.initialSigners = input.initialSigners;
    this.retainedSigners = input.retainedSigners;
  }
}

export class InviteLinkPageDto extends PaginatedListDto(InviteLinkAdminDto) {}
