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
import { KoraProject } from "./entities/kora-project.entity";
import { KoraAdminController } from "./kora-admin.controller";
import { KoraAdminService } from "./kora-admin.service";
import { KoraNotifyService } from "./kora-notify.service";
import { KoraOAuthStateService } from "./kora-oauth-state.service";
import { KoraOAuthController } from "./kora-oauth.controller";
import { KoraParticipantService } from "./kora-participant.service";
import { KoraProjectService } from "./kora-project.service";
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
      KoraProject,
    ]),
    OtpModule,
    MailModule,
    MmsModule,
    OAuthClientsModule,
  ],
  providers: [
    KoraParticipantService,
    KoraSessionService,
    KoraOAuthStateService,
    KoraAdminService,
    KoraProjectService,
    KoraNotifyService,
  ],
  controllers: [KoraController, KoraOAuthController, KoraAdminController],
})
export class KoraModule {}
