import {
  KoraReviewPhase,
  KoraSessionEnd,
  KoraUserBatchStatus,
} from "@alliance/common/kora";
import type { KoraItem } from "@alliance/kora-review";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import type { KoraHome, KoraUserBatch } from "../kora-home";
import type { KoraNextResult, KoraSaved } from "../kora-review.service";
import type { KoraOnboarding, KoraPreferences } from "../kora-reviewer.service";
import { KoraOnboardingDto } from "./kora-onboarding.dto";

export type KoraLoadedSession = {
  id: string;
  number: number;
  budgetUnits: number;
  items: KoraItem[];
  savedExport: Record<string, unknown> | null;
};

export type KoraReviewState = {
  phase: KoraReviewPhase;
  reviewerId: string;
  optOutRisks: string[];
  extendedOptIn: boolean;
  reviewed: boolean;
  sessionsCompleted: number;
  ratingsCompleted: number;
  onboarding: KoraOnboarding;
  session: KoraLoadedSession | null;
};

/** One conversation as the review tool receives it; its shape is the tool's itemSchema. */
export class KoraItemDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  item: Record<string, unknown>;

  constructor(input: KoraItem) {
    this.item = { ...input };
  }
}

export class KoraReviewSessionDto {
  @ApiProperty({ description: "The sessionId the review tool echoes" })
  id: string;

  @ApiProperty({ description: "1-based for this reviewer" })
  number: number;

  @ApiProperty({ description: "Load units this session may spend" })
  budgetUnits: number;

  @ApiProperty({
    type: () => KoraItemDto,
    isArray: true,
    description: "Those given so far; the next comes from the next endpoint",
  })
  items: KoraItemDto[];

  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  savedExport: Record<string, unknown> | null;

  constructor(input: KoraLoadedSession) {
    this.id = input.id;
    this.number = input.number;
    this.budgetUnits = input.budgetUnits;
    this.items = input.items.map((item) => new KoraItemDto(item));
    this.savedExport = input.savedExport;
  }
}

export class KoraReviewStateDto {
  @ApiProperty({ enum: KoraReviewPhase, enumName: "KoraReviewPhase" })
  phase: KoraReviewPhase;

  @ApiProperty({ description: "Opaque; the only identity the tool sees" })
  reviewerId: string;

  @ApiProperty({
    type: String,
    isArray: true,
    description: "Risks the reviewer asked not to be shown",
  })
  optOutRisks: string[];

  @ApiProperty({
    description: "Shown conversations longer than three AI turns",
  })
  extendedOptIn: boolean;

  @ApiProperty({ description: "Has finished at least one session" })
  reviewed: boolean;

  @ApiProperty()
  sessionsCompleted: number;

  @ApiProperty({ description: "Conversations judged, across every session" })
  ratingsCompleted: number;

  @ApiProperty({
    type: () => KoraOnboardingDto,
    description: "What the sign-up screens have saved so far",
  })
  onboarding: KoraOnboardingDto;

  @ApiPropertyOptional({ type: () => KoraReviewSessionDto })
  session?: KoraReviewSessionDto;

  constructor(input: KoraReviewState) {
    this.phase = input.phase;
    this.reviewerId = input.reviewerId;
    this.optOutRisks = input.optOutRisks;
    this.extendedOptIn = input.extendedOptIn;
    this.reviewed = input.reviewed;
    this.sessionsCompleted = input.sessionsCompleted;
    this.ratingsCompleted = input.ratingsCompleted;
    this.onboarding = new KoraOnboardingDto(input.onboarding);
    if (input.session) {
      this.session = new KoraReviewSessionDto(input.session);
    }
  }
}

export class SaveKoraExportDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  export: Record<string, unknown>;
}

export class KoraExportSavedDto {
  @ApiProperty({ description: "The session is over" })
  ended: boolean;

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      "Conversations no longer in the session whose ratings the save dropped; the tool removes them",
  })
  removed: string[];

  constructor(input: KoraSaved) {
    this.ended = input.ended;
    this.removed = input.removed;
  }
}

export class KoraNextConversationDto {
  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "The next conversation, absent once the session has none",
  })
  item?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: KoraSessionEnd,
    enumName: "KoraSessionEnd",
    description: "Why there is no conversation: the budget, or an empty queue",
  })
  done?: KoraSessionEnd;

  constructor(input: KoraNextResult) {
    if ("item" in input) this.item = { ...input.item };
    else this.done = input.done;
  }
}

export class KoraPreferencesDto {
  @ApiProperty({ type: String, isArray: true })
  optOutRisks: string[];

  @ApiProperty()
  extendedOptIn: boolean;

  constructor(input: KoraPreferences) {
    this.optOutRisks = input.optOutRisks;
    this.extendedOptIn = input.extendedOptIn;
  }
}

export class UpdateKoraPreferencesDto {
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: "The whole list, as the account page holds it",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optOutRisks?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  extendedOptIn?: boolean;
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

  @ApiProperty({ description: "Conversations judged or skipped" })
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
  @ApiProperty({
    description: "Conversations judged, not counting skipped ones",
  })
  totalRanked: number;

  @ApiProperty({ type: () => KoraUserBatchDto, isArray: true })
  userBatches: KoraUserBatchDto[];

  constructor(input: KoraHome) {
    this.totalRanked = input.totalRanked;
    this.userBatches = input.userBatches.map((b) => new KoraUserBatchDto(b));
  }
}
