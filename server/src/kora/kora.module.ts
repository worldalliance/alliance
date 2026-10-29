import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OAuthClientsModule } from "src/auth/oauth/oauth-clients.module";
import { OtpModule } from "src/otp/otp.module";
import { KoraParticipantOAuthIdentity } from "./entities/kora-participant-oauth-identity.entity";
import { KoraParticipantSession } from "./entities/kora-participant-session.entity";
import { KoraParticipantSignup } from "./entities/kora-participant-signup.entity";
import { KoraParticipant } from "./entities/kora-participant.entity";
import { KoraOAuthStateService } from "./kora-oauth-state.service";
import { KoraOAuthController } from "./kora-oauth.controller";
import { KoraParticipantService } from "./kora-participant.service";
import { KoraSessionService } from "./kora-session.service";
import { KoraController } from "./kora.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KoraParticipant,
      KoraParticipantOAuthIdentity,
      KoraParticipantSession,
      KoraParticipantSignup,
    ]),
    OtpModule,
    OAuthClientsModule,
  ],
  providers: [
    KoraParticipantService,
    KoraSessionService,
    KoraOAuthStateService,
  ],
  controllers: [KoraController, KoraOAuthController],
})
export class KoraModule {}
