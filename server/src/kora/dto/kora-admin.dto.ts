import { OAuthProvider } from "@alliance/common/oauth";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { KoraAbandonedSignup } from "../entities/kora-abandoned-signup.entity";
import { KoraParticipant } from "../entities/kora-participant.entity";
import { KoraTranscript } from "../entities/kora-transcript.entity";

export type KoraAdminParticipant = {
  participant: KoraParticipant;
  providers: OAuthProvider[];
};

export class KoraAdminParticipantDto extends PickType(KoraParticipant, [
  "id",
  "name",
  "email",
  "phoneNumber",
  "timeZone",
  "createdAt",
]) {
  @ApiProperty({
    enum: OAuthProvider,
    enumName: "OAuthProvider",
    isArray: true,
    description: "Providers connected besides the contact's own code",
  })
  providers: OAuthProvider[];

  constructor(input: KoraAdminParticipant) {
    super();
    this.id = input.participant.id;
    this.name = input.participant.name;
    this.email = input.participant.email;
    this.phoneNumber = input.participant.phoneNumber;
    this.timeZone = input.participant.timeZone;
    this.createdAt = input.participant.createdAt;
    this.providers = input.providers;
  }
}

export type KoraAdminAbandonedSignup = {
  signup: KoraAbandonedSignup;
  recovered: boolean;
};

export class KoraAdminAbandonedSignupDto extends PickType(KoraAbandonedSignup, [
  "id",
  "channel",
  "destination",
  "provider",
  "verifiedAt",
]) {
  @ApiProperty({ description: "The contact has since become a participant" })
  recovered: boolean;

  constructor(input: KoraAdminAbandonedSignup) {
    super();
    this.id = input.signup.id;
    this.channel = input.signup.channel;
    this.destination = input.signup.destination;
    this.provider = input.signup.provider;
    this.verifiedAt = input.signup.verifiedAt;
    this.recovered = input.recovered;
  }
}

export type KoraAdminOverview = {
  participants: KoraAdminParticipant[];
  abandonedSignups: KoraAdminAbandonedSignup[];
};

export class KoraAdminOverviewDto {
  @ApiProperty({ type: () => KoraAdminParticipantDto, isArray: true })
  participants: KoraAdminParticipantDto[];

  @ApiProperty({ type: () => KoraAdminAbandonedSignupDto, isArray: true })
  abandonedSignups: KoraAdminAbandonedSignupDto[];

  constructor(input: KoraAdminOverview) {
    this.participants = input.participants.map(
      (participant) => new KoraAdminParticipantDto(participant),
    );
    this.abandonedSignups = input.abandonedSignups.map(
      (signup) => new KoraAdminAbandonedSignupDto(signup),
    );
  }
}

export type KoraAdminCategory = {
  category: string;
  pairs: number;
  reviewsNeeded: number;
  optedOut: number;
};

export class KoraAdminCategoryDto {
  @ApiProperty()
  category: string;

  @ApiProperty({ description: "Pairs in open batches" })
  pairs: number;

  @ApiProperty({
    description: "Reviews its pairs still need to reach their targets",
  })
  reviewsNeeded: number;

  @ApiProperty({ description: "Reviewers who opted out of it" })
  optedOut: number;

  constructor(input: KoraAdminCategory) {
    this.category = input.category;
    this.pairs = input.pairs;
    this.reviewsNeeded = input.reviewsNeeded;
    this.optedOut = input.optedOut;
  }
}

export class KoraAdminCategoriesDto {
  @ApiProperty({ type: () => KoraAdminCategoryDto, isArray: true })
  categories: KoraAdminCategoryDto[];

  constructor(input: KoraAdminCategory[]) {
    this.categories = input.map((c) => new KoraAdminCategoryDto(c));
  }
}

export type KoraAdminConversation = Pick<KoraTranscript, "id" | "category"> & {
  uploadedAt: Date;
  reviewsPerTranscript: number;
  reviews: number;
  medianTimeMs: number | null;
  minTimeMs: number | null;
  maxTimeMs: number | null;
};

export class KoraAdminConversationDto extends PickType(KoraTranscript, [
  "id",
  "category",
]) {
  @ApiProperty({ description: "When its batch was uploaded" })
  uploadedAt: Date;

  @ApiProperty({ description: "Its batch's review target" })
  reviewsPerTranscript: number;

  @ApiProperty({ description: "Finished reviews" })
  reviews: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Median time finished reviews had it open; null with none",
  })
  medianTimeMs: number | null;

  @ApiProperty({ type: Number, nullable: true })
  minTimeMs: number | null;

  @ApiProperty({ type: Number, nullable: true })
  maxTimeMs: number | null;

  constructor(input: KoraAdminConversation) {
    super();
    this.id = input.id;
    this.category = input.category;
    this.uploadedAt = input.uploadedAt;
    this.reviewsPerTranscript = input.reviewsPerTranscript;
    this.reviews = input.reviews;
    this.medianTimeMs = input.medianTimeMs;
    this.minTimeMs = input.minTimeMs;
    this.maxTimeMs = input.maxTimeMs;
  }
}

export class KoraAdminConversationsDto {
  @ApiProperty({ type: () => KoraAdminConversationDto, isArray: true })
  conversations: KoraAdminConversationDto[];

  constructor(input: KoraAdminConversation[]) {
    this.conversations = input.map((c) => new KoraAdminConversationDto(c));
  }
}
