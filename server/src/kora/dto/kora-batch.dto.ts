import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";
import { KoraBatch } from "../entities/kora-batch.entity";
import type { KoraTranscript } from "../entities/kora-transcript.entity";
import type { KoraBatchSummary } from "../kora-batch.service";

export class KoraBatchDto extends PickType(KoraBatch, [
  "id",
  "transcriptsPerAssignment",
  "reviewsPerTranscript",
  "createdAt",
]) {
  @ApiProperty()
  transcriptCount: number;

  constructor(input: KoraBatchSummary) {
    super();
    this.id = input.batch.id;
    this.transcriptsPerAssignment = input.batch.transcriptsPerAssignment;
    this.reviewsPerTranscript = input.batch.reviewsPerTranscript;
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
}

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
