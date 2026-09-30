import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { MailModule } from "src/mail/mail.module";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";
import { WaitlistMailAllowance } from "./entities/waitlist-mail-allowance.entity";
import { WaitlistMailService } from "./waitlist-mail.service";
import { WaitlistController } from "./waitlist.controller";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WaitlistEntry,
      WaitlistLink,
      WaitlistMailAllowance,
    ]),
    MailModule,
    EventLogModule,
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistMailService],
})
export class WaitlistModule {}
