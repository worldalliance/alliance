import { KoraReviewPhase } from "@alliance/common/kora";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject } from "class-validator";
import type { KoraTranscript } from "../entities/kora-transcript.entity";
import { KoraTranscriptPreviewDto } from "./kora-batch.dto";

export type KoraLoadedAssignment = {
  id: string;
  extra: boolean;
  transcripts: KoraTranscript[];
  savedExport: Record<string, unknown> | null;
};

export type KoraReviewState = {
  phase: KoraReviewPhase;
  reviewerId: string;
  collectProfile: boolean;
  reviewed: boolean;
  extraReviews: number;
  assignment: KoraLoadedAssignment | null;
};

export class KoraReviewAssignmentDto {
  @ApiProperty({ description: "The batchId the review tool echoes" })
  id: string;

  @ApiProperty({ description: "Requested after finishing an earlier one" })
  extra: boolean;

  @ApiProperty({ type: () => KoraTranscriptPreviewDto, isArray: true })
  transcripts: KoraTranscriptPreviewDto[];

  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  savedExport: Record<string, unknown> | null;

  constructor(input: KoraLoadedAssignment) {
    this.id = input.id;
    this.extra = input.extra;
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

export class KoraExportSavedDto {
  @ApiProperty({ description: "Every transcript is done or opted out" })
  completed: boolean;

  constructor(input: { completed: boolean }) {
    this.completed = input.completed;
  }
}
