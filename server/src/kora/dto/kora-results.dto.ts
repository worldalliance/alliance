import { ApiProperty } from "@nestjs/swagger";
import type { QuestionCounts } from "../kora-answers";

export class KoraExportsDto {
  @ApiProperty({
    type: "object",
    additionalProperties: true,
    isArray: true,
    description: "Each export as stored, keyed by its opaque reviewer id",
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
