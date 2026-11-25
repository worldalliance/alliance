import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsInt, Max, Min, MinDate } from "class-validator";
import { KoraBatchEvent } from "../entities/kora-batch-event.entity";
import { KoraBatch } from "../entities/kora-batch.entity";
import type { KoraTranscript } from "../entities/kora-transcript.entity";
import type {
  KoraDeletionImpact,
  KoraLoggedEvent,
} from "../kora-batch-actions.service";
import type { KoraBatchSummary } from "../kora-batch.service";

export class KoraBatchDto extends PickType(KoraBatch, [
  "id",
  "transcriptsPerAssignment",
  "reviewsPerTranscript",
  "retiredAt",
  "closesAt",
  "createdAt",
]) {
  @ApiProperty()
  transcriptCount: number;

  constructor(input: KoraBatchSummary) {
    super();
    this.id = input.batch.id;
    this.transcriptsPerAssignment = input.batch.transcriptsPerAssignment;
    this.reviewsPerTranscript = input.batch.reviewsPerTranscript;
    this.retiredAt = input.batch.retiredAt;
    this.closesAt = input.batch.closesAt;
    this.createdAt = input.batch.createdAt;
    this.transcriptCount = input.transcriptCount;
  }
}

export class UploadKoraBatchDto {
  @ApiProperty({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  transcriptsPerAssignment: number;

  @ApiProperty({ minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  reviewsPerTranscript: number;

  @ApiProperty({ type: Date, description: "Must be in the future" })
  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date())
  closesAt: Date;
}

export class SetKoraBatchClosesAtDto extends PickType(UploadKoraBatchDto, [
  "closesAt",
]) {}

export class KoraRejectedLineDto {
  @ApiProperty()
  line: number;

  @ApiProperty({ type: String, isArray: true })
  problems: string[];
}

export class KoraUploadRejectedDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => KoraRejectedLineDto, isArray: true })
  rejected: KoraRejectedLineDto[];
}

export class KoraTranscriptPreviewDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  transcript: Record<string, unknown>;

  @ApiProperty()
  contentHash: string;

  constructor(input: KoraTranscript) {
    this.transcript = transcriptContent(input);
    this.contentHash = input.contentHash;
  }
}

/** Content was validated against transcriptSchema when stored. */
export function transcriptContent(
  transcript: KoraTranscript,
): Record<string, unknown> {
  const { content } = transcript;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error(`Kora transcript ${transcript.id} has no content object`);
  }
  return Object.fromEntries(Object.entries(content));
}

export class KoraDeletionImpactDto {
  @ApiProperty()
  transcriptCount: number;

  @ApiProperty()
  ratingCount: number;

  @ApiProperty()
  assignmentCount: number;

  constructor(input: KoraDeletionImpact) {
    this.transcriptCount = input.transcriptCount;
    this.ratingCount = input.ratingCount;
    this.assignmentCount = input.assignmentCount;
  }
}

export class KoraBatchEventDto extends PickType(KoraBatchEvent, [
  "id",
  "kind",
  "batchId",
  "batchUploadedAt",
  "transcriptCount",
  "ratingCount",
  "assignmentCount",
  "assignmentId",
  "reviewerId",
  "adminName",
  "createdAt",
]) {
  @ApiProperty({
    description: "The event names an assignment that no longer exists",
  })
  assignmentDeleted: boolean;

  constructor(input: KoraLoggedEvent) {
    super();
    const { event } = input;
    this.assignmentDeleted = input.assignmentDeleted;
    this.id = event.id;
    this.kind = event.kind;
    this.batchId = event.batchId;
    this.batchUploadedAt = event.batchUploadedAt;
    this.transcriptCount = event.transcriptCount;
    this.ratingCount = event.ratingCount;
    this.assignmentCount = event.assignmentCount;
    this.assignmentId = event.assignmentId;
    this.reviewerId = event.reviewerId;
    this.adminName = event.adminName;
    this.createdAt = event.createdAt;
  }
}
