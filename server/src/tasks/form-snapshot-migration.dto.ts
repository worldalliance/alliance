import { MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH } from "@alliance/common/forms/snapshot-migration";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";
import { Form, loadedFormSnapshot } from "./entities/form.entity";
import { FormResponse } from "./entities/formresponse.entity";
import { FormSnapshot } from "./entities/formsnapshot.entity";

export class FormSnapshotDto extends PickType(FormSnapshot, [
  "id",
  "hash",
  "createdAt",
]) {
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schema: Record<string, unknown>;

  constructor(snapshot: FormSnapshot) {
    super();
    this.id = snapshot.id;
    this.hash = snapshot.hash;
    this.createdAt = snapshot.createdAt;
    this.schema = snapshot.schema;
  }
}

export class SnapshotResponseSummaryDto extends PickType(FormResponse, [
  "id",
  "createdAt",
]) {
  @ApiPropertyOptional()
  @IsOptional()
  userName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  userId?: number;

  constructor(response: FormResponse) {
    super();
    this.id = response.id;
    this.createdAt = response.createdAt;
    this.userName = response.user?.name;
    this.userId = response.user?.id;
  }
}

export type SnapshotResponseGroup = {
  snapshot: FormSnapshot;
  responses: FormResponse[];
};

export class SnapshotResponseGroupDto {
  @ApiProperty({ type: () => FormSnapshotDto })
  @IsDefined()
  @Type(() => FormSnapshotDto)
  snapshot: FormSnapshotDto;

  @ApiProperty({ type: () => SnapshotResponseSummaryDto, isArray: true })
  @IsArray()
  @Type(() => SnapshotResponseSummaryDto)
  responses: SnapshotResponseSummaryDto[];

  constructor(input: SnapshotResponseGroup) {
    this.snapshot = new FormSnapshotDto(input.snapshot);
    this.responses = input.responses.map(
      (r) => new SnapshotResponseSummaryDto(r),
    );
  }
}

export type FormSnapshotMigration = {
  form: Form;
  groups: SnapshotResponseGroup[];
};

export class FormSnapshotMigrationDto {
  @ApiProperty()
  @IsString()
  formTitle: string;

  @ApiProperty({ type: () => FormSnapshotDto })
  @IsDefined()
  @Type(() => FormSnapshotDto)
  latestSnapshot: FormSnapshotDto;

  @ApiProperty({ type: () => SnapshotResponseGroupDto, isArray: true })
  @IsArray()
  @Type(() => SnapshotResponseGroupDto)
  groups: SnapshotResponseGroupDto[];

  constructor(input: FormSnapshotMigration) {
    this.formTitle = input.form.title;
    this.latestSnapshot = new FormSnapshotDto(loadedFormSnapshot(input.form));
    this.groups = input.groups.map((g) => new SnapshotResponseGroupDto(g));
  }
}

export class MigrateResponseSnapshotsDto {
  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH)
  @IsInt({ each: true })
  responseIds: number[];

  @ApiProperty()
  @IsInt()
  targetSnapshotId: number;
}

export class MigrateResponseSnapshotsResultDto {
  @ApiProperty()
  updatedCount: number;

  constructor(updatedCount: number) {
    this.updatedCount = updatedCount;
  }
}
