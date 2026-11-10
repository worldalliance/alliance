import { OAuthProvider } from "@alliance/common/oauth";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { KoraAbandonedSignup } from "../entities/kora-abandoned-signup.entity";
import { KoraParticipant } from "../entities/kora-participant.entity";

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
