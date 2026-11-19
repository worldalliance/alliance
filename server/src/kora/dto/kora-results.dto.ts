import { ApiProperty } from "@nestjs/swagger";
import type { QuestionCounts } from "../kora-answers";

export class KoraExportsDto {
  @ApiProperty({
    type: "object",
    additionalProperties: true,
    isArray: true,
    description:
      "Each export as stored, keyed by its opaque reviewer id, with koraBatches: the upload batches its conversations come from, each { id, retired }",
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
  @ApiProperty({ description: "Sessions whose feedback was answered" })
  sessions: number;

  @ApiProperty({ type: () => KoraQuestionCountsDto, isArray: true })
  feedback: KoraQuestionCountsDto[];

  constructor(input: { sessions: number; feedback: QuestionCounts[] }) {
    this.sessions = input.sessions;
    this.feedback = input.feedback;
  }
}

export type KoraSessionExport = {
  id: string;
  reviewerId: string;
  endedAt: Date | null;
  export: Record<string, unknown> | null;
};

export class KoraSessionExportDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reviewerId: string;

  @ApiProperty({ type: Date, nullable: true })
  endedAt: Date | null;

  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  export: Record<string, unknown> | null;

  constructor(input: KoraSessionExport) {
    this.id = input.id;
    this.reviewerId = input.reviewerId;
    this.endedAt = input.endedAt;
    this.export = input.export;
  }
}
