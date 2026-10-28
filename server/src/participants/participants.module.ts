import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OtpModule } from "src/otp/otp.module";
import { ProjectParticipantSession } from "./entities/project-participant-session.entity";
import { ProjectParticipantSignup } from "./entities/project-participant-signup.entity";
import { ProjectParticipant } from "./entities/project-participant.entity";
import { ParticipantSessionService } from "./participant-session.service";
import { ParticipantService } from "./participant.service";
import { ParticipantsController } from "./participants.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectParticipant,
      ProjectParticipantSession,
      ProjectParticipantSignup,
    ]),
    OtpModule,
  ],
  providers: [ParticipantService, ParticipantSessionService],
  controllers: [ParticipantsController],
})
export class ParticipantsModule {}
