import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OAuthClientsModule } from "src/auth/oauth/oauth-clients.module";
import { MailModule } from "src/mail/mail.module";
import { MmsModule } from "src/mms/mms.module";
import { OtpModule } from "src/otp/otp.module";
import { PushModule } from "src/push/push.module";
import { User } from "src/user/entities/user.entity";
import { KoraAbandonedSignup } from "./entities/kora-abandoned-signup.entity";
import { KoraAssignmentTranscript } from "./entities/kora-assignment-transcript.entity";
import { KoraAssignment } from "./entities/kora-assignment.entity";
import { KoraBatchEvent } from "./entities/kora-batch-event.entity";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraParticipantOAuthIdentity } from "./entities/kora-participant-oauth-identity.entity";
import { KoraParticipantSession } from "./entities/kora-participant-session.entity";
import { KoraParticipantSignup } from "./entities/kora-participant-signup.entity";
import { KoraParticipant } from "./entities/kora-participant.entity";
import { KoraProject } from "./entities/kora-project.entity";
import { KoraReviewer } from "./entities/kora-reviewer.entity";
import { KoraTranscript } from "./entities/kora-transcript.entity";
import { KoraAdminController } from "./kora-admin.controller";
import { KoraAdminService } from "./kora-admin.service";
import { KoraBatchActionsService } from "./kora-batch-actions.service";
import { KoraBatchService } from "./kora-batch.service";
import { KoraBatchesController } from "./kora-batches.controller";
import { KoraNotifyService } from "./kora-notify.service";
import { KoraOAuthStateService } from "./kora-oauth-state.service";
import { KoraOAuthController } from "./kora-oauth.controller";
import { KoraParticipantService } from "./kora-participant.service";
import { KoraProjectService } from "./kora-project.service";
import { KoraResultsController } from "./kora-results.controller";
import { KoraResultsService } from "./kora-results.service";
import { KoraReviewController } from "./kora-review.controller";
import { KoraReviewService } from "./kora-review.service";
import { KoraSessionService } from "./kora-session.service";
import { KoraController } from "./kora.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KoraAbandonedSignup,
      KoraAssignment,
      KoraAssignmentTranscript,
      KoraBatch,
      KoraBatchEvent,
      KoraParticipant,
      KoraParticipantOAuthIdentity,
      KoraParticipantSession,
      KoraParticipantSignup,
      KoraProject,
      KoraReviewer,
      KoraTranscript,
      User,
    ]),
    OtpModule,
    MailModule,
    MmsModule,
    PushModule,
    OAuthClientsModule,
  ],
  providers: [
    KoraParticipantService,
    KoraSessionService,
    KoraOAuthStateService,
    KoraAdminService,
    KoraProjectService,
    KoraNotifyService,
    KoraBatchService,
    KoraBatchActionsService,
    KoraReviewService,
    KoraResultsService,
  ],
  controllers: [
    KoraController,
    KoraOAuthController,
    KoraAdminController,
    KoraBatchesController,
    KoraReviewController,
    KoraResultsController,
  ],
})
export class KoraModule {}
