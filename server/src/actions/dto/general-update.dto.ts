import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateIf,
} from "class-validator";
import { displayOnlySchemaOf } from "src/tasks/display-only-snapshot";
import { Tag } from "src/user/entities/tag.entity";
import { ActionSuite } from "../entities/action-suite.entity";
import { GeneralUpdate } from "../entities/general-update.entity";

function schemaOf(generalUpdate: GeneralUpdate): DisplayOnlySchema {
  return displayOnlySchemaOf({
    owner: "GeneralUpdate",
    ownerId: generalUpdate.id,
    snapshot: generalUpdate.schemaSnapshot,
  });
}

export class GeneralUpdateDto extends PickType(GeneralUpdate, [
  "id",
  "name",
  "startDate",
  "endDate",
  "priority",
]) {
  @ApiProperty()
  @Type(() => Object)
  schema: DisplayOnlySchema;

  constructor(generalUpdate: GeneralUpdate) {
    super();
    this.id = generalUpdate.id;
    this.name = generalUpdate.name;
    this.schema = schemaOf(generalUpdate);
    this.startDate = generalUpdate.startDate;
    this.endDate = generalUpdate.endDate;
    this.priority = generalUpdate.priority;
  }
}

export class GeneralUpdateAdminDto extends PickType(GeneralUpdate, [
  "id",
  "name",
  "schemaSnapshotId",
  "startDate",
  "endDate",
  "createdAt",
  "updatedAt",
  "useManualCohort",
  "manualCohortUserIds",
  "priority",
]) {
  @ApiProperty()
  @Type(() => Object)
  schema: DisplayOnlySchema;

  @ApiProperty({ type: () => Tag, isArray: true })
  @Type(() => Tag)
  tags: Tag[];

  @ApiPropertyOptional({ type: () => ActionSuite, isArray: true })
  @Type(() => ActionSuite)
  suites?: ActionSuite[];

  constructor(generalUpdate: GeneralUpdate) {
    super();
    this.id = generalUpdate.id;
    this.name = generalUpdate.name;
    this.schema = schemaOf(generalUpdate);
    this.schemaSnapshotId = generalUpdate.schemaSnapshotId;
    this.startDate = generalUpdate.startDate;
    this.endDate = generalUpdate.endDate;
    this.createdAt = generalUpdate.createdAt;
    this.updatedAt = generalUpdate.updatedAt;
    this.useManualCohort = generalUpdate.useManualCohort;
    this.manualCohortUserIds = generalUpdate.manualCohortUserIds;
    this.priority = generalUpdate.priority;
    this.tags = generalUpdate.tags ?? [];
    this.suites = generalUpdate.suites ?? [];
  }
}

export class CreateGeneralUpdateDto extends PickType(GeneralUpdate, [
  "name",
  "startDate",
  "endDate",
  "useManualCohort",
  "manualCohortUserIds",
]) {
  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: Number, isArray: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  suiteIds?: number[];
}

export class UpdateGeneralUpdateDto extends PartialType(
  PickType(GeneralUpdate, [
    "name",
    "startDate",
    "endDate",
    "useManualCohort",
    "manualCohortUserIds",
  ]),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  schema?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Number })
  @ValidateIf((dto: UpdateGeneralUpdateDto) => dto.schema !== undefined)
  @IsInt()
  expectedSchemaSnapshotId?: number;

  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: Number, isArray: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  suiteIds?: number[];
}
