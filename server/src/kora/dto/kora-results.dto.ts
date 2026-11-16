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
