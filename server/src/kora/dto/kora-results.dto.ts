import { ApiProperty } from "@nestjs/swagger";
import type { QuestionCounts } from "../kora-answers";

export class KoraExportsDto {
  @ApiProperty({
    type: "object",
    additionalProperties: true,
    isArray: true,
    description:
      "Each export as stored, keyed by its opaque reviewer id, with koraBatches: the upload batches its transcripts come from, each { id, retired }",
  })
  exports: Record<string, unknown>[];

  constructor(input: { exports: Record<string, unknown>[] }) {
    this.exports = input.exports;
  }
}

export class KoraAnswerCountDto {
  @ApiProperty()
  value: string;

  @ApiProperty()
  count: number;
}

export class KoraQuestionCountsDto {
  @ApiProperty()
  question: string;

  @ApiProperty({ type: () => KoraAnswerCountDto, isArray: true })
  answers: KoraAnswerCountDto[];
}

export class KoraAnswerCountsDto {
  @ApiProperty({ description: "Reviewers who answered the profile" })
  profiles: number;

  @ApiProperty({ type: () => KoraQuestionCountsDto, isArray: true })
  profile: KoraQuestionCountsDto[];

  @ApiProperty({ description: "Exit surveys answered" })
  exitSurveys: number;

  @ApiProperty({ type: () => KoraQuestionCountsDto, isArray: true })
  exitSurvey: KoraQuestionCountsDto[];

  constructor(input: {
    profiles: number;
    profile: QuestionCounts[];
    exitSurveys: number;
    exitSurvey: QuestionCounts[];
  }) {
    this.profiles = input.profiles;
    this.profile = input.profile;
    this.exitSurveys = input.exitSurveys;
    this.exitSurvey = input.exitSurvey;
  }
}

export type KoraAssignmentExport = {
  id: string;
  reviewerId: string;
  completedAt: Date | null;
  export: Record<string, unknown> | null;
};

export class KoraAssignmentExportDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reviewerId: string;

  @ApiProperty({ type: Date, nullable: true })
  completedAt: Date | null;

  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  export: Record<string, unknown> | null;

  constructor(input: KoraAssignmentExport) {
    this.id = input.id;
    this.reviewerId = input.reviewerId;
    this.completedAt = input.completedAt;
    this.export = input.export;
  }
}

const ROWS = {
  type: "object",
  additionalProperties: true,
  isArray: true,
} as const;

/** KORA's export (docs/kora/kora_export.schema.yaml): a header and five tables. */
export class KoraSpecExportDto {
  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description: "export_id, kind, generated_at, spec_version and row counts",
  })
  export: Record<string, unknown>;

  @ApiProperty({ ...ROWS, description: "One per completed rating" })
  ratings: Record<string, unknown>[];

  @ApiProperty({ ...ROWS, description: "One per highlighted passage" })
  highlights: Record<string, unknown>[];

  @ApiProperty({ ...ROWS, description: "One per session started" })
  sessions: Record<string, unknown>[];

  @ApiProperty({ ...ROWS, description: "One per conversation skipped" })
  skips: Record<string, unknown>[];

  @ApiProperty({ ...ROWS, description: "One per reviewer" })
  reviewers: Record<string, unknown>[];

  constructor(input: KoraSpecExportDto) {
    this.export = input.export;
    this.ratings = input.ratings;
    this.highlights = input.highlights;
    this.sessions = input.sessions;
    this.skips = input.skips;
    this.reviewers = input.reviewers;
  }
}
