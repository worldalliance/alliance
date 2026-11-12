import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OAuthClientsModule } from "src/auth/oauth/oauth-clients.module";
import { MailModule } from "src/mail/mail.module";
import { MmsModule } from "src/mms/mms.module";
import { OtpModule } from "src/otp/otp.module";
import { KoraAbandonedSignup } from "./entities/kora-abandoned-signup.entity";
import { KoraParticipantOAuthIdentity } from "./entities/kora-participant-oauth-identity.entity";
import { KoraParticipantSession } from "./entities/kora-participant-session.entity";
import { KoraParticipantSignup } from "./entities/kora-participant-signup.entity";
import { KoraParticipant } from "./entities/kora-participant.entity";
import { KoraAdminController } from "./kora-admin.controller";
import { KoraAdminService } from "./kora-admin.service";
import { KoraConfirmationService } from "./kora-confirmation.service";
import { KoraOAuthStateService } from "./kora-oauth-state.service";
import { KoraOAuthController } from "./kora-oauth.controller";
import { KoraParticipantService } from "./kora-participant.service";
import { KoraSessionService } from "./kora-session.service";
import { KoraController } from "./kora.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KoraAbandonedSignup,
      KoraParticipant,
      KoraParticipantOAuthIdentity,
      KoraParticipantSession,
      KoraParticipantSignup,
    ]),
    OtpModule,
    OAuthClientsModule,
    MailModule,
    MmsModule,
  ],
  providers: [
    KoraParticipantService,
    KoraSessionService,
    KoraOAuthStateService,
    KoraAdminService,
    KoraConfirmationService,
  ],
  controllers: [KoraController, KoraOAuthController, KoraAdminController],
})
export class KoraModule {}
