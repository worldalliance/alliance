import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { MailModule } from "src/mail/mail.module";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { WaitlistBrowser } from "./entities/waitlist-browser.entity";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";
import { WaitlistMailAllowance } from "./entities/waitlist-mail-allowance.entity";
import { WaitlistAdminController } from "./waitlist-admin.controller";
import { WaitlistBrowserService } from "./waitlist-browser.service";
import { WaitlistEntryAdminService } from "./waitlist-entry-admin.service";
import { WaitlistLinkService } from "./waitlist-link.service";
import { WaitlistMailService } from "./waitlist-mail.service";
import { WaitlistController } from "./waitlist.controller";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      WaitlistBrowser,
      WaitlistEntry,
      WaitlistLink,
      WaitlistMailAllowance,
    ]),
    MailModule,
    EventLogModule,
    UserModule,
  ],
  controllers: [WaitlistController, WaitlistAdminController],
  providers: [
    WaitlistService,
    WaitlistMailService,
    WaitlistBrowserService,
    WaitlistLinkService,
    WaitlistEntryAdminService,
  ],
})
export class WaitlistModule {}
