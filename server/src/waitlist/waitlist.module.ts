import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { MailModule } from "src/mail/mail.module";
import { UserModule } from "src/user/user.module";
import { WaitlistBrowser } from "./entities/waitlist-browser.entity";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";
import { WaitlistMailAllowance } from "./entities/waitlist-mail-allowance.entity";
import { WaitlistBrowserService } from "./waitlist-browser.service";
import { WaitlistMailService } from "./waitlist-mail.service";
import { WaitlistController } from "./waitlist.controller";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WaitlistBrowser,
      WaitlistEntry,
      WaitlistLink,
      WaitlistMailAllowance,
    ]),
    MailModule,
    EventLogModule,
    UserModule,
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistMailService, WaitlistBrowserService],
})
export class WaitlistModule {}
