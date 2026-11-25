import { KoraReviewPhase, KoraUserBatchStatus } from "@alliance/common/kora";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsObject, Max, Min } from "class-validator";
import type { KoraTranscript } from "../entities/kora-transcript.entity";
import { KORA_ACTIVE_REPORT_MAX_SECONDS } from "../kora-active-time";
import type { KoraHome, KoraUserBatch } from "../kora-home";
import type { KoraSaved } from "../kora-review.service";
import { KoraTranscriptPreviewDto } from "./kora-batch.dto";

export type KoraLoadedAssignment = {
  id: string;
  extra: boolean;
  size: number;
  transcripts: KoraTranscript[];
  savedExport: Record<string, unknown> | null;
};

export type KoraReviewState = {
  phase: KoraReviewPhase;
  reviewerId: string;
  collectProfile: boolean;
  optOutCategories: string[];
  reviewed: boolean;
  extraReviews: number;
  assignment: KoraLoadedAssignment | null;
};

export class KoraReviewAssignmentDto {
  @ApiProperty({ description: "The batchId the review tool echoes" })
  id: string;

  @ApiProperty({ description: "Requested after finishing an earlier one" })
  extra: boolean;

  @ApiProperty({ description: "How many transcripts the assignment asks for" })
  size: number;

  @ApiProperty({
    type: () => KoraTranscriptPreviewDto,
    isArray: true,
    description: "Those given so far; the next comes from the next endpoint",
  })
  transcripts: KoraTranscriptPreviewDto[];

  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  savedExport: Record<string, unknown> | null;

  constructor(input: KoraLoadedAssignment) {
    this.id = input.id;
    this.extra = input.extra;
    this.size = input.size;
    this.transcripts = input.transcripts.map(
      (t) => new KoraTranscriptPreviewDto(t),
    );
    this.savedExport = input.savedExport;
  }
}

export class KoraReviewStateDto {
  @ApiProperty({ enum: KoraReviewPhase, enumName: "KoraReviewPhase" })
  phase: KoraReviewPhase;

  @ApiProperty({ description: "Opaque; the only identity the tool sees" })
  reviewerId: string;

  @ApiProperty()
  collectProfile: boolean;

  @ApiProperty({
    type: String,
    isArray: true,
    description: "Categories the reviewer opted out of in any assignment",
  })
  optOutCategories: string[];

  @ApiProperty({ description: "Has finished at least one assignment" })
  reviewed: boolean;

  @ApiProperty({ description: "Reviews finished in extra assignments" })
  extraReviews: number;

  @ApiPropertyOptional({ type: () => KoraReviewAssignmentDto })
  assignment?: KoraReviewAssignmentDto;

  constructor(input: KoraReviewState) {
    this.phase = input.phase;
    this.reviewerId = input.reviewerId;
    this.collectProfile = input.collectProfile;
    this.optOutCategories = input.optOutCategories;
    this.reviewed = input.reviewed;
    this.extraReviews = input.extraReviews;
    if (input.assignment) {
      this.assignment = new KoraReviewAssignmentDto(input.assignment);
    }
  }
}

export class SaveKoraExportDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  export: Record<string, unknown>;
}

export class ReportKoraActiveTimeDto {
  @ApiProperty({
    description:
      "Seconds of visible, recently used review time since the last report",
  })
  @IsInt()
  @Min(1)
  @Max(KORA_ACTIVE_REPORT_MAX_SECONDS)
  seconds: number;
}

export class KoraExportSavedDto {
  @ApiProperty({ description: "The assignment is finished" })
  completed: boolean;

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      "Transcripts no longer in the assignment whose results the save dropped; the tool removes them",
  })
  removed: string[];

  constructor(input: KoraSaved) {
    this.completed = input.completed;
    this.removed = input.removed;
  }
}

export class KoraNextTranscriptDto {
  @ApiProperty({
    type: () => KoraTranscriptPreviewDto,
    nullable: true,
    description: "Null once the assignment is full or nothing is left to give",
  })
  next: KoraTranscriptPreviewDto | null;

  constructor(input: KoraTranscript | null) {
    this.next = input ? new KoraTranscriptPreviewDto(input) : null;
  }
}

export class KoraUserBatchDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Null for an offer not yet started",
  })
  id: string | null;

  @ApiProperty({ enum: KoraUserBatchStatus, enumName: "KoraUserBatchStatus" })
  status: KoraUserBatchStatus;

  @ApiProperty({ type: Date })
  releasedAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  closesAt: Date | null;

  @ApiProperty({ description: "Pairs ranked or skipped" })
  progress: number;

  @ApiProperty()
  total: number;

  constructor(input: KoraUserBatch) {
    this.id = input.id;
    this.status = input.status;
    this.releasedAt = input.releasedAt;
    this.closesAt = input.closesAt;
    this.progress = input.progress;
    this.total = input.total;
  }
}

export class KoraHomeDto {
  @ApiProperty({ description: "Pairs ranked, not counting skipped ones" })
  totalRanked: number;

  @ApiProperty({ type: () => KoraUserBatchDto, isArray: true })
  userBatches: KoraUserBatchDto[];

  constructor(input: KoraHome) {
    this.totalRanked = input.totalRanked;
    this.userBatches = input.userBatches.map((b) => new KoraUserBatchDto(b));
  }
}
