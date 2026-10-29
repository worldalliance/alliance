import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OtpModule } from "src/otp/otp.module";
import { KoraParticipantSession } from "./entities/kora-participant-session.entity";
import { KoraParticipantSignup } from "./entities/kora-participant-signup.entity";
import { KoraParticipant } from "./entities/kora-participant.entity";
import { KoraParticipantService } from "./kora-participant.service";
import { KoraSessionService } from "./kora-session.service";
import { KoraController } from "./kora.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KoraParticipant,
      KoraParticipantSession,
      KoraParticipantSignup,
    ]),
    OtpModule,
  ],
  providers: [KoraParticipantService, KoraSessionService],
  controllers: [KoraController],
})
export class KoraModule {}
