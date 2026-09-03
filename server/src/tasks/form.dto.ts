// src/forms/dto/create-form.dto.ts
import {
  DEVICE_VISIBILITY_TARGETS,
  type DeviceVisibilityTarget,
} from "@alliance/common/forms/device";
import {
  FORM_RESPONSES_BY_FORMS_MAX_BATCH,
  type FormAnswers,
} from "@alliance/common/forms/form-responses";
import type { AggregateViewSchema } from "@alliance/common/forms/form-schema";
import { MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH } from "@alliance/common/forms/snapshot-migration";
import type { VisibilityValidatorResults } from "@alliance/common/forms/visibility";
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";
import type { LinkedAction } from "src/actions/actions.service";
import { Action } from "src/actions/entities/action.entity";
import { AiDetectionResultDto } from "src/ai-detection/dto/ai-detection-result.dto";
import { AiDetectionResult } from "src/ai-detection/entities/ai-detection-result.entity";
import { UserDto } from "src/user/dto/user.dto";
import { Form } from "./entities/form.entity";
import {
  FormResponse,
  type ParsedFormResponse,
} from "./entities/formresponse.entity";
import {
  FormResponseDraft,
  type ParsedFormResponseDraft,
} from "./entities/formresponsedraft.entity";
import { FormSnapshot } from "./entities/formsnapshot.entity";

export class CreateFormDto extends PickType(Form, ["title"]) {
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schema: Record<string, unknown>;
}

export class UpdateFormDto extends PickType(CreateFormDto, ["schema"]) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  /** Expected snapshot id; stale values return 409. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  expectedFormSnapshotId?: number;
}

export class SubmitFormDto extends PickType(FormResponse, [
  "answers",
  "phDistinctId",
  "sessionReplayUrl",
]) {
  // BACKCOMPAT(form-snapshot): formSnapshotId is the canonical field for
  // newer clients. Old mobile builds (pre-snapshot-cutover) still post
  // `schemaSnapshot` instead. Once the minimum supported mobile version is
  // past the cutover, make this @IsDefined and delete schemaSnapshot below.
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  formSnapshotId?: number;

  // BACKCOMPAT(form-snapshot): accepted only from old clients that don't
  // yet know about formSnapshotId. Server hashes this and resolves it to a
  // pre-existing historical snapshot for the form — submissions whose
  // schema doesn't match any historical snapshot are rejected. Remove once
  // the minimum supported mobile version is past the snapshot cutover.
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @Type(() => Object)
  schemaSnapshot?: Record<string, unknown>;

  @ApiProperty()
  @IsInt()
  actionId: number;

  // class-validator can't express the id-keyed record; the service parses it.
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @Type(() => Object)
  visibilityValidatorResults?: unknown;

  @ApiProperty({ enum: DEVICE_VISIBILITY_TARGETS })
  @IsEnum(DEVICE_VISIBILITY_TARGETS)
  @IsDefined()
  deviceType: DeviceVisibilityTarget;

  @ApiPropertyOptional({ type: Object })
  @Type(() => Object)
  @IsOptional()
  publicAnswers?: Record<string, boolean>;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  sid?: string;
}

export class SubmitFollowUpFormDto extends OmitType(SubmitFormDto, [
  "actionId",
]) {}

export class FormDto extends PickType(Form, ["id", "title", "formSnapshotId"]) {
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schema: Record<string, unknown>;

  constructor(form: Form) {
    super();
    this.id = form.id;
    this.title = form.title;
    this.formSnapshotId = form.formSnapshotId;
    this.schema = form.formSnapshot.schema;
  }
}

export class FormLinkedActionDto extends PickType(Action, ["id", "name"]) {
  constructor(input: LinkedAction) {
    super();
    this.id = input.id;
    this.name = input.name;
  }
}

export type FormSchemaCounts = {
  pages: number;
  fields: number;
};

export class FormSchemaCountsDto {
  @ApiProperty()
  pages: number;

  @ApiProperty()
  fields: number;

  constructor(input: FormSchemaCounts) {
    this.pages = input.pages;
    this.fields = input.fields;
  }
}

export type FormSummary = {
  id: number;
  title: string;
  formSnapshotId: number;
  /** Absent when the stored schema no longer parses. */
  schemaCounts?: FormSchemaCounts;
  usedInAction?: LinkedAction;
};

/**
 * The forms index. Deliberately carries no schema: the admin lists ~100 forms
 * at once and every form picker in the builder mounts the same list, so the
 * two numbers it renders are counted in SQL rather than shipped as ~900 KB of
 * schemas for the client to count itself.
 */
export class FormSummaryDto extends PickType(Form, [
  "id",
  "title",
  "formSnapshotId",
]) {
  @ApiPropertyOptional({ type: () => FormSchemaCountsDto })
  @IsOptional()
  @Type(() => FormSchemaCountsDto)
  schemaCounts?: FormSchemaCountsDto;

  @ApiPropertyOptional({ type: () => FormLinkedActionDto })
  @IsOptional()
  @Type(() => FormLinkedActionDto)
  usedInAction?: FormLinkedActionDto;

  constructor(input: FormSummary) {
    super();
    this.id = input.id;
    this.title = input.title;
    this.formSnapshotId = input.formSnapshotId;
    this.schemaCounts =
      input.schemaCounts && new FormSchemaCountsDto(input.schemaCounts);
    this.usedInAction =
      input.usedInAction && new FormLinkedActionDto(input.usedInAction);
  }
}

export class FormAggregateViewsDto {
  @ApiProperty({ type: Object, isArray: true })
  aggregateViews: AggregateViewSchema[];

  constructor(aggregateViews: AggregateViewSchema[]) {
    this.aggregateViews = aggregateViews;
  }
}

export type FormResponseDtoArgs = {
  response: ParsedFormResponse;
  aiDetectionResults?: AiDetectionResult[];
};

export class FormResponseDto extends PickType(FormResponse, [
  "id",
  "answers",
  "formId",
  "formSnapshotId",
  "createdAt",
  "phDistinctId",
  "sessionReplayUrl",
  "deviceType",
  "sid",
  "publicAnswers",
]) {
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schemaSnapshot: Record<string, unknown>;

  @ApiProperty({ type: Object })
  @IsDefined()
  @Type(() => Object)
  visibilityValidatorResults: VisibilityValidatorResults;

  @ApiPropertyOptional({ type: () => UserDto })
  @IsOptional()
  @Type(() => UserDto)
  user?: UserDto;

  @ApiPropertyOptional({ type: () => AiDetectionResultDto, isArray: true })
  @IsOptional()
  @Type(() => AiDetectionResultDto)
  aiDetectionResults?: AiDetectionResultDto[];

  constructor(input: FormResponseDtoArgs) {
    super();
    const { response, aiDetectionResults } = input;
    this.id = response.id;
    this.formId = response.formId;
    this.formSnapshotId = response.formSnapshotId;
    this.answers = response.answers;
    this.schemaSnapshot = response.formSnapshot.schema;
    this.visibilityValidatorResults = response.visibilityValidatorResults;
    this.publicAnswers = response.publicAnswers;
    this.deviceType = response.deviceType;
    this.sessionReplayUrl = response.sessionReplayUrl;
    this.sid = response.sid;
    this.phDistinctId = response.phDistinctId;
    this.createdAt = response.createdAt;
    this.user = response.user;
    this.aiDetectionResults = aiDetectionResults?.map(
      (result) => new AiDetectionResultDto(result),
    );
  }
}

export class LinkedGuestDraftDto {
  @ApiPropertyOptional({ type: () => FormResponseDto })
  @IsOptional()
  @Type(() => FormResponseDto)
  draft?: FormResponseDto;

  constructor(draft?: ParsedFormResponse | null) {
    this.draft = draft ? new FormResponseDto({ response: draft }) : undefined;
  }
}

export class SaveFormDraftDto extends PickType(FormResponseDraft, [
  "actionId",
  "formSnapshotId",
]) {
  @ApiProperty({ type: Object })
  @IsDefined()
  @Type(() => Object)
  answers: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @Type(() => Object)
  publicAnswers?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  currentPageIndex?: number;
}

export type FormDraft = Pick<
  ParsedFormResponseDraft,
  | "formId"
  | "actionId"
  | "formSnapshotId"
  | "answers"
  | "publicAnswers"
  | "currentPageIndex"
  | "updatedAt"
>;

export class FormDraftDto extends PickType(FormResponseDraft, [
  "formId",
  "actionId",
  "formSnapshotId",
  "publicAnswers",
  "currentPageIndex",
  "updatedAt",
]) {
  @ApiProperty({ type: Object })
  @IsDefined()
  @Type(() => Object)
  answers: FormAnswers;

  constructor(draft: FormDraft) {
    super();
    this.formId = draft.formId;
    this.actionId = draft.actionId;
    this.formSnapshotId = draft.formSnapshotId;
    this.answers = draft.answers;
    this.publicAnswers = draft.publicAnswers;
    this.currentPageIndex = draft.currentPageIndex;
    this.updatedAt = draft.updatedAt;
  }
}

export class MaybeFormDraftDto {
  @ApiPropertyOptional({ type: () => FormDraftDto })
  @IsOptional()
  @Type(() => FormDraftDto)
  draft?: FormDraftDto;

  constructor(draft: FormDraft | null) {
    this.draft = draft ? new FormDraftDto(draft) : undefined;
  }
}

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
    this.latestSnapshot = new FormSnapshotDto(input.form.formSnapshot);
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

export class FormResponsesByFormsDto {
  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(FORM_RESPONSES_BY_FORMS_MAX_BATCH)
  @IsInt({ each: true })
  formIds: number[];
}

export type FormResponseCount = {
  formId: number;
  count: number;
};

export class FormResponseCountDto {
  @ApiProperty()
  formId: number;

  @ApiProperty()
  count: number;

  constructor(input: FormResponseCount) {
    this.formId = input.formId;
    this.count = input.count;
  }
}

export class GuestFormResponseDto {
  @ApiPropertyOptional({ type: () => FormResponseDto })
  @IsOptional()
  @Type(() => FormResponseDto)
  response?: FormResponseDto;

  constructor(response?: ParsedFormResponse | null) {
    this.response = response ? new FormResponseDto({ response }) : undefined;
  }
}
