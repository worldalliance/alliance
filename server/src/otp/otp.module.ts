import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailModule } from "src/mail/mail.module";
import { MmsModule } from "src/mms/mms.module";
import { OtpChallenge } from "./otp-challenge.entity";
import { OtpRateEvent } from "./otp-rate-event.entity";
import { OtpService } from "./otp.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([OtpChallenge, OtpRateEvent]),
    MailModule,
    MmsModule,
  ],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
